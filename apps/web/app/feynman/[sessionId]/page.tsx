'use client';

import type { Turn } from '@say-clear/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, sendFeynmanMessage } from '@/lib/api-client';

export default function FeynmanPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.getSession(sessionId).then((s) => setTurns(s.turns ?? [])).catch((e) => setError(e.message));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  async function send() {
    const text = input.trim();
    if (!text || sending || finishing) return;
    const now = new Date().toISOString();
    setInput('');
    setSending(true);
    setError(null);
    setTurns((t) => [
      ...t,
      { role: 'user', content: text, ts: now },
      { role: 'assistant', content: '', ts: now },
    ]);

    try {
      await sendFeynmanMessage(sessionId, text, (delta) => {
        setTurns((t) => {
          const next = [...t];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '追问失败，请重试');
      setTurns((t) => {
        const next = [...t];
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
    <main className="mx-auto flex h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="mb-6">
        <p className="text-sm text-neutral-500">费曼闯关</p>
        <h1 className="mt-1 text-2xl font-semibold">讲给这个听不懂的笨学生</h1>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto rounded-3xl bg-white p-5 shadow-sm">
        <div className="space-y-4">
          {turns.map((turn, index) => (
            <div key={index} className={turn.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={
                  turn.role === 'user'
                    ? 'inline-block max-w-[80%] rounded-3xl bg-neutral-950 px-5 py-3 text-left text-sm leading-6 text-white'
                    : 'inline-block max-w-[80%] rounded-3xl bg-blue-50 px-5 py-3 text-left text-sm leading-6 text-blue-900'
                }
              >
                {turn.content || (turn.role === 'assistant' && sending ? '…' : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </section>

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending || finishing}
          className="min-h-24 w-full resize-none rounded-2xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-900"
          placeholder="用自己的话讲给他听…"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex gap-3">
          <button
            onClick={send}
            disabled={sending || finishing}
            className="flex-1 rounded-2xl border border-neutral-200 px-5 py-3 text-sm font-medium disabled:opacity-60"
          >
            {sending ? '追问生成中…' : '发送'}
          </button>
          <button
            onClick={finish}
            disabled={sending || finishing}
            className="flex-1 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {finishing ? '生成报告中…' : '我讲完了'}
          </button>
        </div>
      </section>
    </main>
  );
}
