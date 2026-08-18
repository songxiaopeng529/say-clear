import { buildFirstQuestion } from '@say-clear/core';
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
    const ctx = await loadBookContext(params.id, userId);
    if (!ctx) notFound('书不存在');

    const firstQuestion = buildFirstQuestion(ctx);
    const turns: Turn[] = [
      { role: 'assistant', content: firstQuestion, ts: new Date().toISOString() },
    ];
    const session = await prisma.feynmanSession.create({
      data: {
        bookId: params.id,
        userId,
        flowVersion: 2,
        turns: turns as unknown as object,
      },
    });
    return NextResponse.json({ id: session.id, firstQuestion }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
