'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api-client';

export default function NewBookPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [highlight, setHighlight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    if (!title.trim()) {
      setError('先填一下书名');
      return;
    }
    if (!highlight.trim()) {
      setError('贴一句触动你的原文');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const book = await api.createBook({
        title: title.trim(),
        author: author.trim() || undefined,
      });
      await api.addHighlight(book.id, {
        content: highlight.trim(),
        sourceType: 'text',
      });
      const session = await api.startSession(book.id);
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
        <h1 className="text-3xl font-semibold tracking-tight">加一本书</h1>
        <p className="mt-2 text-sm text-neutral-500">先确定你要讲清楚哪本书，再贴 1-3 句原文。</p>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">书名</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-900"
          placeholder="例如：原则"
        />
        <label className="mt-5 block text-sm font-medium">作者（选填）</label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-900"
          placeholder="例如：Ray Dalio"
        />
        <label className="mt-5 block text-sm font-medium">触动你的原文</label>
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
