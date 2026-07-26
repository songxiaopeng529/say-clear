import { createBookSchema } from '@say-clear/types';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await requireUser();
    const list = await prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(list);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireUser();
    const body = createBookSchema.parse(await request.json());
    const book = await prisma.book.create({
      data: { userId, title: body.title, author: body.author ?? null },
    });
    return NextResponse.json(book, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
