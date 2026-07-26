import {
  buildCardExtractPrompt,
  buildCardExtractSystemPrompt,
  renderConversation,
} from '@say-clear/core';
import { extractCardDraft } from '@say-clear/ai';
import type { Turn } from '@say-clear/types';
import { NextResponse } from 'next/server';
import { handleApiError, notFound } from '@/lib/api-error';
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
    });
    if (!session) notFound('会话不存在');

    const turns = session.turns as unknown as Turn[];
    const draft = await extractCardDraft({
      system: buildCardExtractSystemPrompt(),
      prompt: buildCardExtractPrompt({
        conversation: renderConversation(turns),
        clarityReportJson: JSON.stringify(session.clarityReport ?? {}),
      }),
    });

    const card = await prisma.opinionCard.upsert({
      where: { sessionId: params.id },
      create: {
        bookId: session.bookId,
        sessionId: params.id,
        userId,
        coreOpinion: draft.coreOpinion,
        myExample: draft.myExample,
        unclearPoints: draft.unclearPoints,
      },
      update: {
        coreOpinion: draft.coreOpinion,
        myExample: draft.myExample,
        unclearPoints: draft.unclearPoints,
      },
    });
    return NextResponse.json({ ...card, sourceQuotes: draft.sourceQuotes }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
