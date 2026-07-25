'use client';

import type { OpinionCard } from '@say-clear/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export default function CardPage() {
  const [cards, setCards] = useState<OpinionCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCards().then(setCards).catch((e) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">我的观点卡片</h1>
          <p className="mt-2 text-sm text-neutral-500">这些内容来自你自己的讲解，不是 AI 总结。</p>
        </div>
        <Link href="/shelf" className="rounded-2xl border border-neutral-200 px-5 py-3 text-sm font-medium">
          回到书架
        </Link>
      </header>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {cards.length === 0 ? (
        <section className="rounded-3xl bg-white p-10 text-center text-neutral-500">
          还没有观点卡片。先完成一次费曼闯关。
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.id} className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-xs font-medium text-blue-600">我的核心观点</p>
              <p className="mt-2 text-base leading-7">{card.coreOpinion}</p>
              {card.myExample && (
                <>
                  <p className="mt-5 text-xs font-medium text-blue-600">我的例子</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">{card.myExample}</p>
                </>
              )}
              {card.unclearPoints && (
                <>
                  <p className="mt-5 text-xs font-medium text-orange-600">我还没想清的点</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">{card.unclearPoints}</p>
                </>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
