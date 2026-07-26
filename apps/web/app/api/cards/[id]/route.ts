import { updateCardSchema } from '@say-clear/types';
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
    const card = await prisma.opinionCard.findFirst({
      where: { id: params.id, userId },
    });
    if (!card) notFound('卡片不存在');
    return NextResponse.json(card);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await requireUser();
    const body = updateCardSchema.parse(await request.json());
    const existing = await prisma.opinionCard.findFirst({
      where: { id: params.id, userId },
    });
    if (!existing) notFound('卡片不存在');
    const card = await prisma.opinionCard.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(card);
  } catch (e) {
    return handleApiError(e);
  }
}
