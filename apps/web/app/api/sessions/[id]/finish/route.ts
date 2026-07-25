import {
  buildClarityReportPrompt,
  buildClarityReportSystemPrompt,
  renderConversation,
} from '@say-clear/core';
import { generateClarityReport } from '@say-clear/ai';
import type { Turn } from '@say-clear/types';
import { NextResponse } from 'next/server';
import { handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { loadBookContext } from '@/lib/book-context';
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

    const ctx = await loadBookContext(session.bookId);
    if (!ctx) notFound('书不存在');

    const turns = session.turns as unknown as Turn[];
    const report = await generateClarityReport({
      system: buildClarityReportSystemPrompt(),
      prompt: buildClarityReportPrompt({
        ctx,
        conversation: renderConversation(turns),
      }),
    });

    await prisma.feynmanSession.update({
      where: { id: params.id },
      data: {
        clarityReport: report as unknown as object,
        status: report.pass ? 'passed' : 'ongoing',
        finishedAt: report.pass ? new Date() : null,
      },
    });
    return NextResponse.json(report);
  } catch (e) {
    return handleApiError(e);
  }
}
