'use client';

import type {
  Book,
  Highlight,
  OpinionCard,
  SessionProgress,
  Turn,
} from '@say-clear/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { SessionResult } from '@/components/feynman/SessionResult';
import {
  api,
  sendFeynmanMessage,
  type SessionResponse,
} from '@/lib/api-client';

type BookWithDetails = Book & { highlights: Highlight[]; cards: OpinionCard[] };
type PagePhase = 'loading' | 'ready' | 'submitting' | 'finalizing' | 'terminal';
type BusyAction = 'card' | 'restart' | 'abandon' | null;
type RetryAction =
  | { kind: 'load' }
  | { kind: 'send'; content: string; requestId: string }
  | { kind: 'finalize' }
  | { kind: 'card' }
  | { kind: 'restart' }
  | { kind: 'abandon' };

const quickReplies = [
  '换句话说……',
  '我的例子是……',
  '因为……所以……',
  '我不确定的是……',
];

function initialOf(text: string) {
  return text.trim().slice(0, 1).toUpperCase() || 'S';
}

function countUserTurns(turns: Turn[]) {
  return turns.filter((turn) => turn.role === 'user').length;
}

function progressFor(session: SessionResponse | null): SessionProgress {
  if (session?.progress) return session.progress;
  return {
    userTurnCount: session ? countUserTurns(session.turns) : 0,
    minUserTurns: 2,
    maxUserTurns: 3,
  };
}

export default function FeynmanPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [book, setBook] = useState<BookWithDetails | null>(null);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [pendingAnswer, setPendingAnswer] = useState<Turn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const answerRequestRef = useRef<string | null>(null);
  const finalizeRequestRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPhase('loading');
      setError(null);
      setRetryAction(null);
      try {
        const sessionData = await api.getSession(sessionId);
        const bookData = await api.getBook(sessionData.bookId);
        if (cancelled) return;

        setSession(sessionData);
        setBook(bookData);

        const loadedProgress = progressFor(sessionData);
        const legacyNeedsFinalization =
          sessionData.status === 'ongoing' &&
          loadedProgress.userTurnCount >= loadedProgress.maxUserTurns;

        if (sessionData.status === 'ongoing' && !legacyNeedsFinalization) {
          setPhase('ready');
          return;
        }
        if (
          sessionData.status === 'abandoned' ||
          ((sessionData.status === 'passed' ||
            sessionData.status === 'needs_work') &&
            sessionData.clarityReport)
        ) {
          setPhase('terminal');
          return;
        }

        setPhase('finalizing');
        try {
          const result = await api.finishSession(sessionId);
          if (cancelled) return;
          setSession({
            ...sessionData,
            ...result.session,
            clarityReport: result.report,
            finalization: result.finalization ?? result.session.finalization,
          });
          setPhase('terminal');
        } catch (finishError) {
          if (cancelled) return;
          setError(
            finishError instanceof Error
              ? finishError.message
              : '清晰度报告生成失败，请重试',
          );
          setRetryAction({ kind: 'finalize' });
          setPhase('terminal');
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '加载闯关会话失败');
        setRetryAction({ kind: 'load' });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, sessionId]);

  const turns = session?.turns ?? [];
  const visibleTurns = useMemo(
    () => (pendingAnswer ? [...turns, pendingAnswer] : turns),
    [pendingAnswer, turns],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [phase, visibleTurns]);

  const highlights = book?.highlights ?? [];
  const bookTitle = book?.title ?? '加载中';
  const bookAuthor = book?.author ?? '未知作者';
  const bookInitial = initialOf(book?.title ?? 'S');
  const progress = progressFor(session);

  const visibleHighlights = useMemo(() => {
    if (highlights.length > 0) return highlights.slice(0, 4);
    return [];
  }, [highlights]);

  function clearError() {
    setError(null);
    setRetryAction(null);
  }

  async function submitAnswer(content: string, requestId: string) {
    if (
      !session ||
      session.status !== 'ongoing' ||
      answerRequestRef.current !== null
    ) {
      return;
    }
    answerRequestRef.current = requestId;

    const optimisticTurn: Turn = {
      role: 'user',
      content,
      ts: new Date().toISOString(),
    };
    clearError();
    setInput('');
    setPendingAnswer(optimisticTurn);
    setPhase('submitting');

    try {
      const response = await sendFeynmanMessage(sessionId, content, requestId);
      if (answerRequestRef.current !== requestId) return;
      const nextSession: SessionResponse = {
        ...response.session,
        progress: response.progress,
        cardId: session.cardId,
      };
      setPendingAnswer(null);
      setSession(nextSession);

      if (response.outcome === 'continue') {
        setPhase('ready');
        return;
      }

      if (response.finalization === 'ready' && nextSession.clarityReport) {
        setPhase('terminal');
        return;
      }

      answerRequestRef.current = null;
      await finalizeSession(nextSession);
    } catch (sendError) {
      if (answerRequestRef.current !== requestId) return;
      setPendingAnswer(null);
      setInput((current) => current || content);
      setError(sendError instanceof Error ? sendError.message : '判断失败，请重试');
      setRetryAction({ kind: 'send', content, requestId });
      setPhase('ready');
    } finally {
      if (answerRequestRef.current === requestId) {
        answerRequestRef.current = null;
      }
    }
  }

  function send() {
    const content = input.trim();
    if (!content || phase !== 'ready' || session?.status !== 'ongoing') return;

    const requestId =
      retryAction?.kind === 'send' && retryAction.content === content
        ? retryAction.requestId
        : globalThis.crypto.randomUUID();
    void submitAnswer(content, requestId);
  }

  async function finalizeSession(baseSession: SessionResponse | null = session) {
    const baseProgress = progressFor(baseSession);
    const legacyAtAnswerLimit =
      baseSession?.status === 'ongoing' &&
      baseProgress.userTurnCount >= baseProgress.maxUserTurns;
    if (
      !baseSession ||
      (baseSession.status !== 'passed' &&
        baseSession.status !== 'needs_work' &&
        !legacyAtAnswerLimit)
    ) {
      return;
    }
    if (finalizeRequestRef.current) return;
    finalizeRequestRef.current = true;

    clearError();
    setPhase('finalizing');
    try {
      const result = await api.finishSession(sessionId);
      setSession({
        ...baseSession,
        ...result.session,
        clarityReport: result.report,
        finalization: result.finalization ?? result.session.finalization,
      });
      setPhase('terminal');
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : '清晰度报告生成失败，请重试',
      );
      setRetryAction({ kind: 'finalize' });
      setPhase('terminal');
    } finally {
      finalizeRequestRef.current = false;
    }
  }

  async function abandon() {
    if (!session || session.status !== 'ongoing' || phase !== 'ready') return;
    const confirmed = window.confirm(
      '确认提前结束这次闯关吗？提前结束不会生成报告或观点卡片。',
    );
    if (!confirmed) return;

    clearError();
    setBusyAction('abandon');
    setPhase('submitting');
    try {
      const result = await api.abandonSession(sessionId);
      setSession({
        ...result.session,
        progress: result.progress ?? result.session.progress,
        finalization: result.finalization ?? result.session.finalization,
        cardId: session.cardId,
      });
      setPhase('terminal');
    } catch (abandonError) {
      setError(
        abandonError instanceof Error ? abandonError.message : '提前结束失败，请重试',
      );
      setRetryAction({ kind: 'abandon' });
      setPhase('ready');
    } finally {
      setBusyAction(null);
    }
  }

  async function createCard() {
    if (!session || session.status !== 'passed') return;
    if (session.cardId) {
      router.push('/card');
      return;
    }

    clearError();
    setBusyAction('card');
    try {
      const card = await api.createCard(sessionId);
      setSession((current) => (current ? { ...current, cardId: card.id } : current));
      router.push('/card');
    } catch (cardError) {
      setError(cardError instanceof Error ? cardError.message : '观点卡片生成失败，请重试');
      setRetryAction({ kind: 'card' });
    } finally {
      setBusyAction(null);
    }
  }

  async function restart() {
    if (!session) return;
    clearError();
    setBusyAction('restart');
    try {
      const nextSession = await api.startSession(session.bookId);
      router.push(`/feynman/${nextSession.id}`);
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : '新闯关创建失败，请重试');
      setRetryAction({ kind: 'restart' });
      setBusyAction(null);
    }
  }

  function retry() {
    if (!retryAction) return;
    switch (retryAction.kind) {
      case 'load':
        setReloadKey((current) => current + 1);
        return;
      case 'send':
        void submitAnswer(retryAction.content, retryAction.requestId);
        return;
      case 'finalize':
        void finalizeSession();
        return;
      case 'card':
        void createCard();
        return;
      case 'restart':
        void restart();
        return;
      case 'abandon':
        void abandon();
    }
  }

  const terminalStatus =
    session?.status !== undefined && session.status !== 'ongoing'
      ? session.status
      : null;

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
            {phase === 'loading' ? (
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
            <FeynmanProgress
              phase={phase}
              progress={progress}
              status={session?.status}
              cardCreated={Boolean(session?.cardId)}
            />
            {error && (
              <div className="mb-5 mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <span>{error}</span>
                {retryAction && (
                  <button
                    type="button"
                    onClick={retry}
                    className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600"
                  >
                    重试
                  </button>
                )}
              </div>
            )}
            {phase === 'loading' && !session ? (
              <div className="mt-5 space-y-5">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-2xl bg-white" />
                ))}
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {visibleTurns.map((turn, index) => (
                  <ChatTurn key={`${turn.ts}-${index}`} turn={turn} />
                ))}
                {phase === 'submitting' && pendingAnswer && (
                  <TypingBubble label="AI 正在判断自己是否听懂……" />
                )}
                {phase === 'finalizing' && (
                  <TypingBubble label="正在整理这次闯关的清晰度报告……" />
                )}
                {phase === 'terminal' && terminalStatus && (
                  <SessionResult
                    status={terminalStatus}
                    report={session?.clarityReport ?? null}
                    cardId={session?.cardId}
                    busyAction={
                      busyAction === 'card' || busyAction === 'restart' ? busyAction : null
                    }
                    onCreateCard={() => void createCard()}
                    onRestart={() => void restart()}
                    onRetryFinalize={() => void finalizeSession()}
                  />
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {session?.status === 'ongoing' && phase !== 'loading' && (
            <section className="h-[150px] border-t border-[#e8e4dc] bg-white px-[60px] pt-4">
              <div className="flex h-[68px] items-center rounded-[14px] border border-[#e8e4dc] bg-[#f5f2ed] px-4">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={phase !== 'ready'}
                  className="h-[42px] flex-1 resize-none bg-transparent pt-2 text-[15px] leading-[20px] text-[#1a1a1a] outline-none placeholder:text-[#b0a898] disabled:opacity-60"
                  placeholder="用自己的话继续讲……"
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
                  disabled={!input.trim() || phase !== 'ready'}
                  className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-black text-white disabled:opacity-40"
                  aria-label="发送回答"
                >
                  <ArrowUpIcon />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[12px] leading-[15px] text-[#b0a898]">
                <span>表达脚手架：</span>
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() =>
                      setInput((current) => (current ? `${current}\n${reply}` : reply))
                    }
                    disabled={phase !== 'ready'}
                    className="rounded-full border border-[#e8e4dc] bg-[#f0ebe3] px-3.5 py-1.5 text-[12px] font-medium leading-[15px] text-[#666] disabled:opacity-50"
                  >
                    {reply}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void abandon()}
                  disabled={phase !== 'ready'}
                  className="ml-auto rounded-full border border-[#d9d3c9] bg-white px-4 py-2 text-[12px] font-semibold leading-[15px] text-[#666] disabled:opacity-40"
                >
                  {busyAction === 'abandon' ? '正在结束…' : '提前结束'}
                </button>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function FeynmanProgress({
  phase,
  progress,
  status,
  cardCreated,
}: {
  phase: PagePhase;
  progress: SessionProgress;
  status?: SessionResponse['status'];
  cardCreated: boolean;
}) {
  const terminal = status !== undefined && status !== 'ongoing';
  const answerNumber = Math.min(
    progress.userTurnCount + (phase === 'submitting' ? 1 : 0) + 1,
    progress.maxUserTurns,
  );
  const progressLabel = terminal
    ? `已回答 ${progress.userTurnCount} / ${progress.maxUserTurns} 次`
    : phase === 'submitting'
      ? `正在判断第 ${Math.min(progress.userTurnCount + 1, progress.maxUserTurns)} / ${progress.maxUserTurns} 次回答`
      : `第 ${answerNumber} / ${progress.maxUserTurns} 次回答`;

  return (
    <div className="flex flex-col items-center gap-2">
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
        <span
          className={`flex h-[30px] items-center rounded-full px-3.5 text-[13px] font-medium leading-4 ${
            cardCreated
              ? 'bg-[#eaf5ee] text-[#397750]'
              : 'bg-[#f0ebe3] text-[#b0a898]'
          }`}
        >
          观点卡片
        </span>
      </div>
      {status && status !== 'abandoned' && (
        <span className="rounded-full border border-[#e8e4dc] bg-white px-3 py-1 text-[11px] font-medium text-[#888]">
          {progressLabel}
        </span>
      )}
    </div>
  );
}

function ChatTurn({ turn }: { turn: Turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[540px] whitespace-pre-wrap rounded-[16px_4px_16px_16px] bg-black px-5 py-4 text-[15px] leading-6 text-white">
          {turn.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3.5">
      <AiAvatar />
      <div className="max-w-[560px] whitespace-pre-wrap rounded-[4px_16px_16px_16px] border border-[#e8e4dc] bg-white px-5 py-4 text-[15px] leading-6 text-[#1a1a1a]">
        {turn.content}
      </div>
    </div>
  );
}

function TypingBubble({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <AiAvatar />
      <div className="flex h-[42px] items-center gap-3 rounded-[4px_16px_16px_16px] bg-[#edecea] px-4 text-[12px] text-[#666]">
        <span className="flex gap-[5px]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9c9b99]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6d6c6a] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1a1a1a] [animation-delay:300ms]" />
        </span>
        {label}
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
