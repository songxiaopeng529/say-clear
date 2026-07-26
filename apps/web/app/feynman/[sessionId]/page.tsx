'use client';

import type { Book, Highlight, OpinionCard, Turn } from '@say-clear/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { api, sendFeynmanMessage } from '@/lib/api-client';

type BookWithDetails = Book & { highlights: Highlight[]; cards: OpinionCard[] };

const quickReplies = ['举个例子', '换个说法', '再细说一点', '我不太确定'];

function initialOf(text: string) {
  return text.trim().slice(0, 1).toUpperCase() || 'S';
}

function userTurnCount(turns: Turn[]) {
  return turns.filter((turn) => turn.role === 'user').length;
}

export default function FeynmanPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [book, setBook] = useState<BookWithDetails | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sessionData = await api.getSession(sessionId);
        if (cancelled) return;
        setTurns(sessionData.turns ?? []);

        const bookData = await api.getBook(sessionData.bookId);
        if (!cancelled) setBook(bookData);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载闯关会话失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, sending]);

  const highlights = book?.highlights ?? [];
  const bookTitle = book?.title ?? '加载中';
  const bookAuthor = book?.author ?? '未知作者';
  const bookInitial = initialOf(book?.title ?? 'S');

  const visibleHighlights = useMemo(() => {
    if (highlights.length > 0) return highlights.slice(0, 4);
    return [];
  }, [highlights]);

  async function send() {
    const text = input.trim();
    if (!text || sending || finishing) return;
    const now = new Date().toISOString();
    setInput('');
    setSending(true);
    setError(null);
    setTurns((current) => [
      ...current,
      { role: 'user', content: text, ts: now },
      { role: 'assistant', content: '', ts: now },
    ]);

    try {
      await sendFeynmanMessage(sessionId, text, (delta) => {
        setTurns((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });
      });
      const latest = await api.getSession(sessionId);
      setTurns(latest.turns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '追问失败，请重试');
      setTurns((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && !last.content) next.pop();
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  async function finish() {
    if (sending || finishing) return;
    setFinishing(true);
    setError(null);
    try {
      await api.finishSession(sessionId);
      await api.createCard(sessionId);
      router.push('/card');
    } catch (e) {
      setError(e instanceof Error ? e.message : '结算失败，请重试');
    } finally {
      setFinishing(false);
    }
  }

  return (
    <main className="min-h-screen min-w-[1180px] bg-[#f5f2ed] text-[#1a1a1a]">
      <AppHeader />

      <div className="flex h-[calc(100vh-68px)] min-h-[832px]">
        <aside className="w-80 shrink-0 border-r border-[#e8e4dc] bg-[#fafaf8]">
          <section className="flex h-[104px] items-center border-b border-[#e8e4dc] px-6">
            <div className="flex h-[60px] w-12 items-center justify-center rounded-md bg-[#d89575] text-[22px] font-bold leading-7 text-white">
              {bookInitial}
            </div>
            <div className="ml-3.5 min-w-0">
              <h1 className="truncate text-[16px] font-semibold leading-5">{bookTitle}</h1>
              <p className="mt-1 truncate text-[13px] leading-4 text-[#666]">{bookAuthor}</p>
            </div>
          </section>

          <section className="px-5 py-5">
            <h2 className="text-[13px] font-semibold leading-4">你的划线原文</h2>
            {loading ? (
              <div className="mt-5 space-y-5">
                {[0, 1].map((item) => (
                  <div
                    key={item}
                    className="h-[119px] animate-pulse rounded-xl border border-[#e8e4dc] bg-[#f0ebe3]"
                  />
                ))}
              </div>
            ) : visibleHighlights.length > 0 ? (
              <div className="mt-5 space-y-5">
                {visibleHighlights.map((highlight, index) => (
                  <article
                    key={highlight.id}
                    className="rounded-xl border border-[#e8e4dc] bg-[#f0ebe3] p-4"
                  >
                    <span className="rounded bg-[#8b7355] px-2 py-1 text-[10px] font-semibold leading-3 text-white">
                      划线 {index + 1}
                    </span>
                    <p className="mt-4 text-[13px] leading-[20.8px] text-[#1a1a1a]">
                      「{highlight.content}」
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-[#e8e4dc] bg-[#f0ebe3] p-4 text-[13px] leading-[20px] text-[#666]">
                暂无划线。返回书籍页补充一段原文后再闯关，追问会更犀利。
              </div>
            )}

            <div className="mt-5 flex h-[42px] items-center rounded-[10px] border border-[#e8e4dc] bg-[#fafaf8] px-3.5 text-[12px] leading-[18px] text-[#888]">
              <LightbulbIcon />
              <span className="ml-2">AI 会基于你的划线进行追问，无法搪塞。</span>
            </div>
          </section>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-[60px] pb-8 pt-3">
            <FeynmanProgress />
            {error && (
              <div className="mb-5 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            {loading ? (
              <div className="mt-5 space-y-5">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-2xl bg-white" />
                ))}
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {turns.map((turn, index) => (
                  <ChatTurn
                    key={`${turn.ts}-${index}`}
                    turn={turn}
                    streaming={sending && index === turns.length - 1}
                  />
                ))}
                {sending && turns[turns.length - 1]?.role !== 'assistant' && <TypingBubble />}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <section className="h-[143px] border-t border-[#e8e4dc] bg-white px-[60px] pt-4">
            <div className="flex h-[68px] items-center rounded-[14px] border border-[#e8e4dc] bg-[#f5f2ed] px-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending || finishing}
                className="h-[42px] flex-1 resize-none bg-transparent pt-2 text-[15px] leading-[20px] text-[#1a1a1a] outline-none placeholder:text-[#b0a898] disabled:opacity-60"
                placeholder="继续说……AI 会根据你划的原文追问"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || sending || finishing}
                className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-black text-white disabled:opacity-40"
                aria-label="发送回答"
              >
                <ArrowUpIcon />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px] leading-[15px] text-[#b0a898]">
              <span>快捷回复：</span>
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => setInput((current) => (current ? `${current}，${reply}` : reply))}
                  disabled={sending || finishing}
                  className="rounded-full border border-[#e8e4dc] bg-[#f0ebe3] px-3.5 py-1.5 text-[12px] font-medium leading-[15px] text-[#666] disabled:opacity-50"
                >
                  {reply}
                </button>
              ))}
              <button
                type="button"
                onClick={finish}
                disabled={sending || finishing || userTurnCount(turns) === 0}
                className="ml-auto rounded-full bg-black px-4 py-2 text-[12px] font-semibold leading-[15px] text-white disabled:opacity-40"
              >
                {finishing ? '生成卡片中…' : '我讲完了'}
              </button>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function FeynmanProgress() {
  return (
    <div className="flex h-[30px] items-center justify-center gap-2">
      <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-[#eaf5ee] px-3.5 text-[13px] font-medium leading-4 text-[#888]">
        <CheckIcon />
        贴划线
      </span>
      <span className="h-px w-4 bg-[#e8e4dc]" />
      <span className="flex h-[30px] items-center rounded-full bg-black px-3.5 text-[13px] font-semibold leading-4 text-white">
        费曼闯关
      </span>
      <span className="h-px w-4 bg-[#e8e4dc]" />
      <span className="flex h-[30px] items-center rounded-full bg-[#f0ebe3] px-3.5 text-[13px] font-medium leading-4 text-[#b0a898]">
        观点卡片
      </span>
    </div>
  );
}

function ChatTurn({ turn, streaming }: { turn: Turn; streaming: boolean }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[540px] rounded-[16px_4px_16px_16px] bg-black px-5 py-4 text-[15px] leading-6 text-white">
          {turn.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3.5">
      <AiAvatar />
      <div className="max-w-[560px] rounded-[4px_16px_16px_16px] border border-[#e8e4dc] bg-white px-5 py-4 text-[15px] leading-6 text-[#1a1a1a]">
        {turn.content || (streaming ? '…' : '')}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-3.5">
      <AiAvatar />
      <div className="flex h-[30px] w-[60px] items-center justify-center gap-[5px] rounded-[4px_16px_16px_16px] bg-[#edecea]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#9c9b99]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#6d6c6a]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
      </div>
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3d8a5a] text-[12px] font-bold text-white">
      AI
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="m2.5 6.7 2.2 2.2 5.8-5.8"
        stroke="#3d8a5a"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5.4 11h3.2M7 1.8a4 4 0 0 0-2.2 7.3c.4.3.6.7.6 1.2h3.2c0-.5.2-.9.6-1.2A4 4 0 0 0 7 1.8Z"
        stroke="#8b7355"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 12.5v-9M4.5 7 8 3.5 11.5 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
