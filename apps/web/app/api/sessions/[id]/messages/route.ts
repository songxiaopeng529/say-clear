import { Prisma } from '@prisma/client';
import { judgeFeynmanTurn } from '@say-clear/ai';
import {
  buildTurnJudgmentPrompt,
  buildTurnJudgmentSystemPrompt,
  isJudgmentEvidenceGrounded,
  renderConversation,
  resolveJudgedTurn,
} from '@say-clear/core';
import {
  postMessageSchema,
  type PostMessageResponse,
  type Turn,
  type TurnJudgmentRecord,
} from '@say-clear/types';
import { NextResponse } from 'next/server';
import { ApiError, handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { loadBookContext } from '@/lib/book-context';
import { prisma } from '@/lib/db';
import {
  MAX_USER_TURNS,
  parseStoredJudgments,
  parseTurns,
  toSessionResponse,
} from '@/lib/feynman-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A crashed request may be safely replaced after its lease expires. */
const PROCESSING_LEASE_MS = 2 * 60 * 1000;

function isActiveLease(startedAt: Date | null, now: Date): boolean {
  return Boolean(
    startedAt && now.getTime() - startedAt.getTime() < PROCESSING_LEASE_MS,
  );
}

async function loadSession(id: string, userId: string) {
  return prisma.feynmanSession.findFirst({
    where: { id, userId },
    include: { card: { select: { id: true } } },
  });
}

function responseForRecord(
  session: NonNullable<Awaited<ReturnType<typeof loadSession>>>,
  record: TurnJudgmentRecord,
): PostMessageResponse {
  const sessionDto = toSessionResponse(session);
  const progress = {
    userTurnCount: sessionDto.progress.userTurnCount,
    minUserTurns: sessionDto.progress.minUserTurns,
    maxUserTurns: sessionDto.progress.maxUserTurns,
  };

  // A request may be replayed after later turns have already advanced the
  // session. The current terminal state is authoritative; returning the old
  // `continue` outcome would leave the client in a non-terminal UI phase.
  if (sessionDto.status === 'passed' || sessionDto.status === 'needs_work') {
    return {
      outcome: sessionDto.status,
      session: sessionDto,
      judgment: sessionDto.finalJudgment ?? record.judgment,
      progress,
      finalization: sessionDto.finalization.completed ? 'ready' : 'pending',
    };
  }

  if (sessionDto.status === 'abandoned') {
    throw new ApiError(
      409,
      'session_finished',
      '本局已经提前结束，不能继续回答',
    );
  }

  if (record.outcome === 'continue') {
    const question = record.judgment.nextProbe?.question.trim();
    if (!question) {
      throw new ApiError(
        500,
        'invalid_saved_judgment',
        '已保存的裁决缺少追问，请重新开始一局',
      );
    }
    return {
      outcome: 'continue',
      session: sessionDto,
      judgment: record.judgment,
      progress,
      question,
    };
  }

  return {
    outcome: record.outcome,
    session: sessionDto,
    judgment: record.judgment,
    progress,
    finalization: sessionDto.finalization.completed ? 'ready' : 'pending',
  };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let acquiredVersion: number | null = null;
  let requestId: string | null = null;
  let userIdForCleanup: string | null = null;

  try {
    const { userId } = await requireUser();
    userIdForCleanup = userId;
    const body = postMessageSchema.parse(await request.json());
    requestId = body.requestId;

    const current = await loadSession(params.id, userId);
    if (!current) notFound('会话不存在');

    const savedJudgments = parseStoredJudgments(current.judgments);
    const duplicate = savedJudgments.find(
      (record) => record.requestId === body.requestId,
    );
    if (duplicate) {
      return NextResponse.json(responseForRecord(current, duplicate));
    }

    if (current.status !== 'ongoing') {
      throw new ApiError(409, 'session_finished', '本局已经结束，不能继续回答');
    }

    const now = new Date();
    if (
      current.processingRequestId &&
      isActiveLease(current.processingStartedAt, now)
    ) {
      throw new ApiError(
        409,
        current.processingRequestId === body.requestId
          ? 'request_in_progress'
          : 'session_busy',
        current.processingRequestId === body.requestId
          ? '这次回答仍在判断中，请稍后重试'
          : '另一条回答仍在判断中，请稍后重试',
      );
    }

    const context = await loadBookContext(current.bookId, userId);
    if (!context) notFound('书不存在');

    const originalTurns = parseTurns(current.turns);
    const existingUserTurnCount = originalTurns.filter(
      (turn) => turn.role === 'user',
    ).length;

    if (existingUserTurnCount >= MAX_USER_TURNS) {
      throw new ApiError(
        409,
        'answer_limit_reached',
        '本局已经达到回答上限，请生成当前清晰度报告',
      );
    }
    const candidateTurns: Turn[] = [
      ...originalTurns,
      {
        role: 'user',
        content: body.content,
        ts: now.toISOString(),
      },
    ];
    const judgedUserTurnCount = existingUserTurnCount + 1;

    const leaseExpiredBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const acquired = await prisma.feynmanSession.updateMany({
      where: {
        id: current.id,
        userId,
        status: 'ongoing',
        version: current.version,
        OR: [
          { processingRequestId: null },
          { processingStartedAt: null },
          { processingStartedAt: { lt: leaseExpiredBefore } },
        ],
      },
      data: {
        processingRequestId: body.requestId,
        processingStartedAt: now,
        version: { increment: 1 },
      },
    });
    if (acquired.count !== 1) {
      throw new ApiError(
        409,
        'session_changed',
        '会话刚刚发生变化，请刷新后重试',
      );
    }
    acquiredVersion = current.version + 1;

    const judgment = await judgeFeynmanTurn({
      system: buildTurnJudgmentSystemPrompt(context),
      prompt: buildTurnJudgmentPrompt({
        conversation: renderConversation(candidateTurns),
        userTurnCount: judgedUserTurnCount,
      }),
    });

    const userMessages = candidateTurns
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.content);
    if (!isJudgmentEvidenceGrounded(judgment, userMessages)) {
      throw new ApiError(
        502,
        'ungrounded_judgment',
        'AI 裁决引用了对话中不存在的原话，请重试',
      );
    }

    let resolved;
    try {
      resolved = resolveJudgedTurn({
        userTurnCount: judgedUserTurnCount,
        judgment,
      });
    } catch (error) {
      throw new ApiError(
        502,
        'invalid_judgment',
        error instanceof Error ? error.message : 'AI 裁决不符合流程规则',
      );
    }
    if (resolved.status !== 'ongoing' && judgment.nextProbe !== null) {
      throw new ApiError(
        502,
        'invalid_judgment',
        '最终裁决不能再包含下一问',
      );
    }

    const persistedTurns: Turn[] = resolved.nextQuestion
      ? [
          ...candidateTurns,
          {
            role: 'assistant',
            content: resolved.nextQuestion,
            ts: new Date().toISOString(),
          },
        ]
      : candidateTurns;
    const record: TurnJudgmentRecord = {
      requestId: body.requestId,
      userTurnCount: judgedUserTurnCount,
      judgment,
      outcome: resolved.outcome,
      createdAt: new Date().toISOString(),
    };
    const judgments = [...savedJudgments, record];
    const terminal = resolved.status !== 'ongoing';

    const persisted = await prisma.feynmanSession.updateMany({
      where: {
        id: current.id,
        userId,
        status: 'ongoing',
        version: acquiredVersion,
        processingRequestId: body.requestId,
      },
      data: {
        flowVersion: 2,
        turns: persistedTurns as unknown as Prisma.InputJsonValue,
        judgments: judgments as unknown as Prisma.InputJsonValue,
        // 旧流程可能在 ongoing 会话上留下临时报告。任何新裁决都必须
        // 使它失效，终态报告随后只能根据 finalJudgment 重新生成。
        clarityReport: Prisma.DbNull,
        finalJudgment: terminal
          ? (judgment as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        status: resolved.status,
        finishedAt: terminal ? new Date() : null,
        processingRequestId: null,
        processingStartedAt: null,
        version: { increment: 1 },
      },
    });
    if (persisted.count !== 1) {
      throw new ApiError(
        409,
        'session_changed',
        '会话在判断期间发生变化，本次结果未写入',
      );
    }
    acquiredVersion = null;

    const updated = await loadSession(current.id, userId);
    if (!updated) notFound('会话不存在');
    return NextResponse.json(responseForRecord(updated, record));
  } catch (error) {
    // Do not leave a live lease behind when the provider or validation fails.
    // The version/request predicates ensure this cannot clear a newer request.
    if (acquiredVersion !== null && requestId && userIdForCleanup) {
      await prisma.feynmanSession
        .updateMany({
          where: {
            id: params.id,
            userId: userIdForCleanup,
            version: acquiredVersion,
            processingRequestId: requestId,
          },
          data: {
            processingRequestId: null,
            processingStartedAt: null,
            version: { increment: 1 },
          },
        })
        .catch((cleanupError) => {
          console.error('[messages] 释放处理租约失败', cleanupError);
        });
    }
    return handleApiError(error);
  }
}
