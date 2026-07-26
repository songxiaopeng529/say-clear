'use client';

import type { Book } from '@say-clear/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { api } from '@/lib/api-client';

const fallbackBooks = [
  { title: '思考，快与慢', author: '丹尼尔·卡尼曼', tone: 'coral', letter: 'T' },
  { title: '纳瓦尔宝典', author: '埃里克·乔根森', tone: 'green', letter: 'N' },
  { title: '非暴力沟通', author: '马歇尔·卢森堡', tone: 'gray', letter: '非' },
];

const bookTones = {
  coral: 'bg-[#d89575]',
  green: 'bg-[#3d8a5a]',
  gray: 'bg-[#6d6c6a]',
};

function initialOf(text: string) {
  return text.trim().slice(0, 1).toUpperCase() || 'S';
}

function bookProgress(index: number) {
  const presets = [
    { cards: 3, percent: 73, status: '进行中', active: true },
    { cards: 1, percent: 21, status: '刚开始', active: false },
    { cards: 5, percent: 100, status: '已完成', active: false },
  ];
  return presets[index % presets.length];
}

export default function ShelfPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingBookId, setStartingBookId] = useState<string | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await api.listBooks();
        if (cancelled) return;
        setBooks(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载书架失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleBooks = useMemo(() => books.slice(0, 6), [books]);
  const completedCount = Math.max(1, Math.min(3, visibleBooks.length || 0));
  const cardCount = visibleBooks.length === 0 ? 0 : visibleBooks.length * 2 + 3;
  const completionRate =
    visibleBooks.length === 0 ? 0 : Math.min(86, 42 + visibleBooks.length * 9);

  async function startFeynman(bookId: string) {
    if (startingBookId || deletingBookId) return;
    setStartingBookId(bookId);
    setError(null);
    try {
      const session = await api.startSession(bookId);
      router.push(`/feynman/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '开始闯关失败，请重试');
      setStartingBookId(null);
    }
  }

  async function deleteBook(book: Book) {
    if (startingBookId || deletingBookId) return;
    const confirmed = window.confirm(`确认删除《${book.title}》吗？相关划线、闯关记录和观点卡片也会一起删除。`);
    if (!confirmed) return;

    setDeletingBookId(book.id);
    setError(null);
    try {
      await api.deleteBook(book.id);
      setBooks((current) => current.filter((item) => item.id !== book.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败，请重试');
    } finally {
      setDeletingBookId(null);
    }
  }

  return (
    <main className="min-h-screen min-w-[1180px] bg-[#f5f2ed] text-[#1a1a1a]">
      <AppHeader />

      <div className="flex h-[calc(100vh-68px)] min-h-[832px]">
        <aside className="w-60 shrink-0 border-r border-[#e8e4dc] bg-[#fafaf8] px-4 pt-6">
          <h1 className="text-[16px] font-bold leading-5">我的书架</h1>
          <div className="mt-5 space-y-1">
            <Link
              href="/shelf"
              className="flex h-9 items-center gap-2.5 rounded-lg bg-[#eaf5ee] px-3.5 text-[13px] font-semibold leading-4 text-[#3d8a5a]"
            >
              <BookIcon />
              正在内化
            </Link>
            <Link
              href="/card"
              className="flex h-9 items-center gap-2.5 rounded-lg px-3.5 text-[13px] font-medium leading-4 text-[#666]"
            >
              <LayersIcon />
              观点卡片库
            </Link>
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto px-[60px] py-10">
          <header className="flex h-14 items-center justify-between">
            <div>
              <h2 className="text-[28px] font-bold leading-[35px]">正在内化的书</h2>
              <p className="mt-1 text-[14px] leading-[17px] text-[#666]">
                本周已完成 {cardCount} 张观点卡片 · {completionRate}% 完成率
              </p>
            </div>
            <Link
              href="/book/new"
              className="flex h-[42px] w-[142px] items-center justify-center gap-2 rounded-full bg-black text-[14px] font-semibold leading-[18px] text-white"
            >
              <PlusIcon />
              开一本新书
            </Link>
          </header>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <section className="mt-8 flex h-[154px] items-center justify-between rounded-2xl bg-black px-10">
            <div>
              <p className="text-[13px] font-medium leading-4 text-[#888]">本周内化进度</p>
              <p className="mt-2 text-[40px] font-bold leading-[50px] text-white">
                {completedCount} 本书
              </p>
              <p className="mt-2 text-[13px] leading-4 text-[#888]">
                已完成 {cardCount} 张观点卡片
              </p>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[32px] font-bold leading-10 text-[#8b7355]">
                  {completionRate}%
                </p>
                <p className="text-[12px] leading-[15px] text-[#888]">完成率</p>
              </div>
              <div className="h-12 w-px bg-[#333]" />
              <div className="text-center">
                <p className="text-[32px] font-bold leading-10 text-white">
                  {visibleBooks.length}
                </p>
                <p className="text-[12px] leading-[15px] text-[#888]">本书</p>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="mt-8 grid grid-cols-3 gap-6">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-[297px] animate-pulse rounded-2xl border border-[#e8e4dc] bg-white"
                />
              ))}
            </div>
          ) : visibleBooks.length === 0 ? (
            <section className="mt-8 flex h-[297px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d6d0c5] bg-white text-center">
              <p className="text-[20px] font-bold">还没有正在内化的书</p>
              <p className="mt-2 text-[14px] text-[#666]">
                开一本新书，贴上划线，然后开始费曼闯关。
              </p>
              <Link
                href="/book/new"
                className="mt-6 rounded-full bg-black px-5 py-3 text-[14px] font-semibold text-white"
              >
                开一本新书
              </Link>
            </section>
          ) : (
            <section className="mt-8 grid grid-cols-3 gap-6">
              {visibleBooks.map((book, index) => (
                <BookCard
                  key={book.id}
                  book={book}
                  index={index}
                  busy={startingBookId === book.id}
                  deleting={deletingBookId === book.id}
                  onStart={startFeynman}
                  onDelete={deleteBook}
                />
              ))}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function BookCard({
  book,
  index,
  busy,
  deleting,
  onStart,
  onDelete,
}: {
  book: Book;
  index: number;
  busy: boolean;
  deleting: boolean;
  onStart: (bookId: string) => void;
  onDelete: (book: Book) => void;
}) {
  const fallback = fallbackBooks[index % fallbackBooks.length];
  const tone = bookTones[fallback.tone as keyof typeof bookTones];
  const progress = bookProgress(index);
  const letter = initialOf(book.title) || fallback.letter;
  const disabled = busy || deleting;

  return (
    <article
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => onStart(book.id)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onStart(book.id);
        }
      }}
      aria-disabled={disabled}
      className={`group relative overflow-hidden rounded-2xl border border-[#e8e4dc] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.07)] ${
        disabled ? 'cursor-wait opacity-70' : 'cursor-pointer'
      }`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(book);
        }}
        disabled={disabled}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#9b2c2c] opacity-0 shadow-sm ring-1 ring-[#e8e4dc] backdrop-blur transition hover:bg-red-50 group-hover:opacity-100 focus:opacity-100 disabled:cursor-wait"
        aria-label={`删除《${book.title}》`}
      >
        {deleting ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 border-t-[#9b2c2c]" />
        ) : (
          <TrashIcon />
        )}
      </button>
      <div className={`flex h-[120px] items-center justify-center ${tone}`}>
        <span className="text-[52px] font-bold leading-[66px] text-white">{letter}</span>
      </div>
      <div className="p-5">
        <h3 className="truncate text-[17px] font-semibold leading-[21px]">{book.title}</h3>
        <p className="mt-1 truncate text-[13px] leading-4 text-[#666]">
          {book.author || '未知作者'}
        </p>
        <div className="mt-8">
          <div className="h-1 rounded-full bg-[#e8e4dc]">
            <div
              className={`h-full rounded-full ${progress.active ? 'bg-[#3d8a5a]' : 'bg-[#8b7355]'}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] leading-[15px] text-[#666]">
            <span>{progress.cards} 张观点卡片</span>
            <span
              className={`rounded px-2 py-1 text-[11px] font-semibold leading-[13px] ${
                progress.active ? 'bg-[#c8f0d8] text-[#3d8a5a]' : 'bg-[#f0ebe3] text-[#8b7355]'
              }`}
            >
              {progress.status}
            </span>
          </div>
        </div>
        <div
          className={`mt-3 flex h-[42px] items-center justify-center rounded-[10px] text-[14px] font-semibold leading-[18px] ${
            progress.active
              ? 'bg-black text-white'
              : 'border border-[#e8e4dc] bg-[#fafaf8] text-[#1a1a1a]'
          }`}
        >
          {deleting ? '删除中…' : busy ? '准备闯关…' : '开始费曼闯关'}
        </div>
      </div>
    </article>
  );
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.5h4.2c.7 0 1.3.6 1.3 1.3v7.7H4.3A1.3 1.3 0 0 1 3 11.2V3.5Zm5.5 1.3c0-.7.6-1.3 1.3-1.3H14v7.7c0 .7-.6 1.3-1.3 1.3H8.5V4.8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5 2.5 5.3 8 8.1l5.5-2.8L8 2.5Zm-5.5 6L8 11.3l5.5-2.8M2.5 11.2 8 14l5.5-2.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M3.25 4.25h8.5M6.25 6.5v3.25M8.75 6.5v3.25M4.25 4.25l.5 7.25c.04.72.6 1.25 1.32 1.25h2.86c.72 0 1.28-.53 1.32-1.25l.5-7.25M6 4.25V3.1c0-.47.38-.85.85-.85h1.3c.47 0 .85.38.85.85v1.15"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
