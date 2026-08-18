import type { BookContext } from '@say-clear/core';
import { prisma } from './db';

/**
 * Load the prompt context only when the requested book belongs to the caller.
 * Prisma commonly connects with a role that bypasses RLS, so ownership must be
 * part of every application-level lookup rather than checked after the read.
 */
export async function loadBookContext(
  bookId: string,
  userId: string,
): Promise<BookContext | null> {
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
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
