import { NextResponse } from 'next/server';
import { handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toSessionResponse } from '@/lib/feynman-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await requireUser();
    const session = await prisma.feynmanSession.findFirst({
      where: { id: params.id, userId },
      include: { card: { select: { id: true } } },
    });
    if (!session) notFound('会话不存在');
    return NextResponse.json(toSessionResponse(session));
  } catch (e) {
    return handleApiError(e);
  }
}
