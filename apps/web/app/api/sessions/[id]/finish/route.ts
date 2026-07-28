import { Prisma } from '@prisma/client';
import { generateClarityReportContent, judgeFeynmanTurn } from '@say-clear/ai';
import {
  buildClarityReportContentPrompt,
  buildClarityReportContentSystemPrompt,
  buildTurnJudgmentPrompt,
  buildTurnJudgmentSystemPrompt,
  isJudgmentEvidenceGrounded,
  renderConversation,
  resolveJudgedTurn,
} from '@say-clear/core';
import type {
  ClarityReport,
  TurnJudgment,
  TurnJudgmentRecord,
} from '@say-clear/types';
import { NextResponse } from 'next/server';
import { ApiError, handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { loadBookContext } from '@/lib/book-context';
import { prisma } from '@/lib/db';
import {
  MAX_USER_TURNS,
  parseFinalJudgment,
  parseStoredJudgments,
  parseTurns,
  toSessionResponse,
} from '@/lib/feynman-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROCESSING_LEASE_MS = 2 * 60 * 1000;

async function loadSession(id: string, userId: string) {
  return prisma.feynmanSession.findFirst({
    where: { id, userId },
    include: { card: { select: { id: true } } },
  });
}

function finishResponse(
  session: NonNullable<Awaited<ReturnType<typeof loadSession>>>,
  report: ClarityReport,
) {
  const dto = toSessionResponse(session);
  return {
    report,
    session: dto,
    finalization: dto.finalization,
  };
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  let leaseRequestId: string | null = null;
  let leaseVersion: number | null = null;
  let cleanupUserId: string | null = null;

  try {
    const { userId } = await requireUser();
    cleanupUserId = userId;
    let session = await loadSession(params.id, userId);
    if (!session) notFound('会话不存在');

    if (session.status === 'abandoned') {
      throw new ApiError(409, 'session_abandoned', '提前结束的会话不生成报告');
    }

    const existingReport = toSessionResponse(session).clarityReport;
    if (
      (session.status === 'passed' || session.status === 'needs_work') &&
      existingReport
    ) {
      return NextResponse.json(finishResponse(session, existingReport));
    }

    const context = await loadBookContext(session.bookId, userId);
    if (!context) notFound('书不存在');

    const turns = parseTurns(session.turns);
    const userTurnCount = turns.filter((turn) => turn.role === 'user').length;
    if (session.status === 'ongoing' && userTurnCount < MAX_USER_TURNS) {
      throw new ApiError(
        409,
        'judgment_required',
        '是否结束由 AI 裁决，请继续回答当前问题或选择提前结束',
      );
    }

    const now = new Date();
    const leaseExpiredBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    leaseRequestId = crypto.randomUUID();
    const acquired = await prisma.feynmanSession.updateMany({
      where: {
        id: session.id,
        userId,
        version: session.version,
        OR: [
          { processingRequestId: null },
          { processingStartedAt: null },
          { processingStartedAt: { lt: leaseExpiredBefore } },
        ],
      },
      data: {
        processingRequestId: leaseRequestId,
        processingStartedAt: now,
        version: { increment: 1 },
      },
    });
    if (acquired.count !== 1) {
      throw new ApiError(
        409,
        'session_busy',
        '会话正在处理中，请稍后重试',
      );
    }
    leaseVersion = session.version + 1;

    // Compatibility path: old ongoing sessions at/over the cap get one final
    // judgment over their existing transcript; no fourth answer is accepted.
    let finalJudgment: TurnJudgment | null = parseFinalJudgment(
      session.finalJudgment,
    );
    if (session.status === 'ongoing') {
      const judgment = await judgeFeynmanTurn({
        system: buildTurnJudgmentSystemPrompt(context),
        prompt: buildTurnJudgmentPrompt({
          conversation: renderConversation(turns),
          userTurnCount: MAX_USER_TURNS,
        }),
      });
      const userMessages = turns
        .filter((turn) => turn.role === 'user')
        .map((turn) => turn.content);
      if (!isJudgmentEvidenceGrounded(judgment, userMessages)) {
        throw new ApiError(
          502,
          'ungrounded_judgment',
          'AI 裁决引用了对话中不存在的原话，请重试',
        );
      }

      const resolved = resolveJudgedTurn({
        userTurnCount: MAX_USER_TURNS,
        judgment,
      });
      if (resolved.status === 'ongoing') {
        throw new ApiError(502, 'invalid_judgment', '最终裁决不能继续追问');
      }
      if (judgment.nextProbe !== null) {
        throw new ApiError(
          502,
          'invalid_judgment',
          '最终裁决不能再包含下一问',
        );
      }
      const record: TurnJudgmentRecord = {
        requestId: leaseRequestId,
        userTurnCount: MAX_USER_TURNS,
        judgment,
        outcome: resolved.outcome,
        createdAt: new Date().toISOString(),
      };
      const judgments = [...parseStoredJudgments(session.judgments), record];
      const judged = await prisma.feynmanSession.updateMany({
        where: {
          id: session.id,
          userId,
          status: 'ongoing',
          version: leaseVersion,
          processingRequestId: leaseRequestId,
        },
        data: {
          flowVersion: 2,
          status: resolved.status,
          judgments: judgments as unknown as Prisma.InputJsonValue,
          finalJudgment: judgment as unknown as Prisma.InputJsonValue,
          clarityReport: Prisma.DbNull,
          finishedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (judged.count !== 1) {
        throw new ApiError(
          409,
          'session_changed',
          '会话在裁决期间发生变化，请刷新后重试',
        );
      }
      leaseVersion += 1;
      finalJudgment = judgment;
      session = {
        ...session,
        flowVersion: 2,
        status: resolved.status,
        judgments: judgments as unknown as Prisma.JsonValue,
        finalJudgment: judgment as unknown as Prisma.JsonValue,
        clarityReport: null,
        finishedAt: new Date(),
        version: leaseVersion,
        processingRequestId: leaseRequestId,
        processingStartedAt: now,
      };
    }

    if (session.status !== 'passed' && session.status !== 'needs_work') {
      throw new ApiError(409, 'session_not_final', '会话尚未形成最终裁决');
    }

    const content = await generateClarityReportContent({
      system: buildClarityReportContentSystemPrompt(),
      prompt: buildClarityReportContentPrompt({
        ctx: context,
        conversation: renderConversation(turns),
        finalOutcome: session.status,
        finalJudgment: finalJudgment ?? undefined,
      }),
    });
    const report: ClarityReport = {
      pass: session.status === 'passed',
      ...content,
    };

    const saved = await prisma.feynmanSession.updateMany({
      where: {
        id: session.id,
        userId,
        status: session.status,
        version: leaseVersion,
        processingRequestId: leaseRequestId,
      },
      data: {
        clarityReport: report as unknown as Prisma.InputJsonValue,
        processingRequestId: null,
        processingStartedAt: null,
        version: { increment: 1 },
      },
    });
    if (saved.count !== 1) {
      throw new ApiError(
        409,
        'session_changed',
        '会话在生成报告期间发生变化，请刷新后重试',
      );
    }
    leaseVersion = null;

    const updated = await loadSession(session.id, userId);
    if (!updated) notFound('会话不存在');
    return NextResponse.json(finishResponse(updated, report));
  } catch (error) {
    if (leaseRequestId && leaseVersion !== null && cleanupUserId) {
      await prisma.feynmanSession
        .updateMany({
          where: {
            id: params.id,
            userId: cleanupUserId,
            version: leaseVersion,
            processingRequestId: leaseRequestId,
          },
          data: {
            processingRequestId: null,
            processingStartedAt: null,
            version: { increment: 1 },
          },
        })
        .catch((cleanupError) => {
          console.error('[finish] 释放处理租约失败', cleanupError);
        });
    }
    return handleApiError(error);
  }
}
