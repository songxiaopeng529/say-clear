'use client';

import type { Book, Highlight, OpinionCard } from '@say-clear/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export default function BookPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookId = params.id;
  const [book, setBook] = useState<(Book & { highlights: Highlight[]; cards: OpinionCard[] }) | null>(null);
  const [highlight, setHighlight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBook(bookId).then(setBook).catch((e) => setError(e.message));
  }, [bookId]);

  async function start() {
    if (busy) return;
    if (!highlight.trim()) {
      setError('贴一句触动你的原文');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.addHighlight(bookId, { content: highlight.trim(), sourceType: 'text' });
      const session = await api.startSession(bookId);
      router.push(`/feynman/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '开始失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm text-neutral-500">继续讲清楚</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{book?.title ?? '加载中…'}</h1>
        {book?.author && <p className="mt-2 text-sm text-neutral-500">{book.author}</p>}
      </div>

      {book?.highlights && book.highlights.length > 0 && (
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-500">已有划线</h2>
          <div className="mt-3 space-y-3">
            {book.highlights.map((h) => (
              <blockquote key={h.id} className="rounded-2xl bg-neutral-50 p-4 text-sm leading-6">
                {h.content}
              </blockquote>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">再贴一段触动你的原文</label>
        <textarea
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
          className="mt-2 min-h-40 w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-900"
          placeholder="粘贴 1-3 句划线…"
        />
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          onClick={start}
          disabled={busy}
          className="mt-6 w-full rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? '准备闯关…' : '开始费曼闯关'}
        </button>
      </section>
    </main>
  );
}
