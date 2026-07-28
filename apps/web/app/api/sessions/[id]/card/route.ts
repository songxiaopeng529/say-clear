import { Prisma } from '@prisma/client';
import {
  buildCardExtractPrompt,
  buildCardExtractSystemPrompt,
  renderConversation,
} from '@say-clear/core';
import { extractCardDraft } from '@say-clear/ai';
import { clarityReportSchema, type Turn } from '@say-clear/types';
import { NextResponse } from 'next/server';
import { ApiError, handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await requireUser();
    const session = await prisma.feynmanSession.findFirst({
      where: { id: params.id, userId },
      include: { card: true },
    });
    if (!session) notFound('会话不存在');
    if (session.status !== 'passed') {
      throw new ApiError(
        409,
        'session_not_passed',
        '只有已经通关的会话才能生成观点卡片',
      );
    }
    const report = clarityReportSchema.safeParse(session.clarityReport);
    if (!report.success) {
      throw new ApiError(409, 'report_required', '请先生成清晰度报告');
    }
    if (session.card) {
      return NextResponse.json(session.card);
    }

    const turns = session.turns as unknown as Turn[];
    const draft = await extractCardDraft({
      system: buildCardExtractSystemPrompt(),
      prompt: buildCardExtractPrompt({
        conversation: renderConversation(turns),
        clarityReportJson: JSON.stringify(report.data),
      }),
    });

    try {
      const card = await prisma.opinionCard.create({
        data: {
          bookId: session.bookId,
          sessionId: params.id,
          userId,
          coreOpinion: draft.coreOpinion,
          myExample: draft.myExample,
          unclearPoints: draft.unclearPoints,
        },
      });
      return NextResponse.json(
        { ...card, sourceQuotes: draft.sourceQuotes },
        { status: 201 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await prisma.opinionCard.findUnique({
          where: { sessionId: params.id },
        });
        if (existing?.userId === userId) return NextResponse.json(existing);
      }
      throw error;
    }
  } catch (e) {
    return handleApiError(e);
  }
}
