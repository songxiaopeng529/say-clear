import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ApiError, handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toSessionResponse } from '@/lib/feynman-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await requireUser();
    const current = await prisma.feynmanSession.findFirst({
      where: { id: params.id, userId },
      include: { card: { select: { id: true } } },
    });
    if (!current) notFound('会话不存在');

    if (current.status === 'abandoned') {
      const session = toSessionResponse(current);
      return NextResponse.json({
        session,
        progress: session.progress,
        finalization: session.finalization,
      });
    }
    if (current.status !== 'ongoing') {
      throw new ApiError(409, 'session_finished', '已经结束的会话不能提前退出');
    }

    // Incrementing version invalidates a model call that may still be in flight.
    const changed = await prisma.feynmanSession.updateMany({
      where: {
        id: current.id,
        userId,
        status: 'ongoing',
        version: current.version,
      },
      data: {
        status: 'abandoned',
        clarityReport: Prisma.DbNull,
        finalJudgment: Prisma.DbNull,
        finishedAt: new Date(),
        processingRequestId: null,
        processingStartedAt: null,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) {
      throw new ApiError(409, 'session_changed', '会话状态刚刚发生变化，请刷新后重试');
    }

    const updated = await prisma.feynmanSession.findFirst({
      where: { id: current.id, userId },
      include: { card: { select: { id: true } } },
    });
    if (!updated) notFound('会话不存在');
    const session = toSessionResponse(updated);
    return NextResponse.json({
      session,
      progress: session.progress,
      finalization: session.finalization,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
