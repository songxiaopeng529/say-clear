import { NextResponse } from 'next/server';
import { handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await requireUser();
    const book = await prisma.book.findFirst({
      where: { id: params.id, userId },
      include: { highlights: true, cards: true },
    });
    if (!book) notFound('书不存在');
    return NextResponse.json(book);
  } catch (e) {
    return handleApiError(e);
  }
}
