import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await requireUser();
    const list = await prisma.opinionCard.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(list);
  } catch (e) {
    return handleApiError(e);
  }
}
