import { createHighlightSchema } from '@say-clear/types';
import { NextResponse } from 'next/server';
import { handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await requireUser();
    const body = createHighlightSchema.parse(await request.json());
    const book = await prisma.book.findFirst({
      where: { id: params.id, userId },
    });
    if (!book) notFound('书不存在');

    const highlight = await prisma.highlight.create({
      data: {
        bookId: params.id,
        userId,
        content: body.content,
        sourceType: body.sourceType,
      },
    });
    return NextResponse.json(highlight, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
