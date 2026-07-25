'use client';

import type { Book } from '@say-clear/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export default function ShelfPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listBooks().then(setBooks).catch((e) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">我的书架</h1>
          <p className="mt-2 text-sm text-neutral-500">读完不算数，说清才算懂。</p>
        </div>
        <Link
          href="/book/new"
          className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white"
        >
          + 加一本书
        </Link>
      </header>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {books.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
          还没有书。加一本，开始把它讲清楚。
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/book/${book.id}`}
              className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-medium">{book.title}</h2>
              {book.author && <p className="mt-2 text-sm text-neutral-500">{book.author}</p>}
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
