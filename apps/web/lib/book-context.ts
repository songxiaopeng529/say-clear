import type { BookContext } from '@say-clear/core';
import { prisma } from './db';

export async function loadBookContext(bookId: string): Promise<BookContext | null> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { highlights: true },
  });
  if (!book) return null;
  return {
    title: book.title,
    author: book.author,
    highlights: book.highlights.map((h) => ({
      ...h,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}
