import type { ClarityReport, SessionStatus } from '@say-clear/types';

const signalLabels = {
  vague: '表达含糊',
  jargon: '术语堆砌',
  logic_gap: '逻辑跳跃',
  mismatch_highlight: '与划线不自洽',
  no_example: '缺少自己的例子',
} as const;

interface SessionResultProps {
  status: Exclude<SessionStatus, 'ongoing'>;
  report: ClarityReport | null;
  cardId?: string | null;
  busyAction: 'card' | 'restart' | null;
  onCreateCard: () => void;
  onRestart: () => void;
  onRetryFinalize: () => void;
}

export function SessionResult({
  status,
  report,
  cardId,
  busyAction,
  onCreateCard,
  onRestart,
  onRetryFinalize,
}: SessionResultProps) {
  if (status === 'abandoned') {
    return (
      <ResultShell tone="neutral" eyebrow="本次已结束" title="你提前结束了这次闯关">
        <p className="mt-2 text-[14px] leading-6 text-[#666]">
          这次不会生成清晰度报告或观点卡片。准备好时，可以从同一本书重新开始。
        </p>
        <button
          type="button"
          onClick={onRestart}
          disabled={busyAction !== null}
          className="mt-6 rounded-full bg-black px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {busyAction === 'restart' ? '准备新闯关…' : '再来一局'}
        </button>
      </ResultShell>
    );
  }

  const passed = status === 'passed';

  if (!report) {
    return (
      <ResultShell
        tone={passed ? 'success' : 'warning'}
        eyebrow={passed ? '表达已讲清' : '本次闯关结束'}
        title="清晰度报告还没有生成完成"
      >
        <p className="mt-2 text-[14px] leading-6 text-[#666]">
          你的闯关结果已经保存，可以安全重试，不会重复记一轮回答。
        </p>
        <button
          type="button"
          onClick={onRetryFinalize}
          className="mt-6 rounded-full bg-black px-5 py-2.5 text-[13px] font-semibold text-white"
        >
          重新生成报告
        </button>
      </ResultShell>
    );
  }

  return (
    <ResultShell
      tone={passed ? 'success' : 'warning'}
      eyebrow={passed ? '闯关通过' : '还有一个关键盲区'}
      title={report.oneLineVerdict}
    >
      <div className="mt-6 grid grid-cols-2 gap-4">
        <section className="rounded-xl border border-[#dbeade] bg-[#f4faf5] p-4">
          <h3 className="text-[13px] font-semibold text-[#2f7048]">已经讲清楚</h3>
          <div className="mt-3 space-y-3">
            {report.greenPoints.map((item, index) => (
              <div key={`${item.point}-${index}`}>
                <p className="text-[13px] font-medium leading-5 text-[#1a1a1a]">
                  {item.point}
                </p>
                <p className="mt-0.5 text-[12px] leading-5 text-[#666]">{item.why}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#eadfce] bg-[#fcf8f1] p-4">
          <h3 className="text-[13px] font-semibold text-[#8b6439]">
            {report.redPoints.length > 0 ? '可以继续想想' : '表达没有明显盲区'}
          </h3>
          {report.redPoints.length > 0 ? (
            <div className="mt-3 space-y-3">
              {report.redPoints.map((item, index) => (
                <div key={`${item.point}-${index}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium leading-5 text-[#1a1a1a]">
                      {item.point}
                    </p>
                    <span className="rounded-full bg-[#efe4d3] px-2 py-0.5 text-[10px] font-medium text-[#8b6439]">
                      {signalLabels[item.signal]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-5 text-[#666]">
                    {item.gentleHint}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[12px] leading-5 text-[#666]">
              一个没读过这本书的人，已经能顺着你的表达复述主要意思。
            </p>
          )}
        </section>
      </div>

      <div className="mt-6 flex items-center gap-3">
        {passed ? (
          <button
            type="button"
            onClick={onCreateCard}
            disabled={busyAction !== null}
            className="rounded-full bg-black px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {busyAction === 'card'
              ? '正在沉淀观点…'
              : cardId
                ? '查看观点卡片'
                : '沉淀为观点卡片'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRestart}
            disabled={busyAction !== null}
            className="rounded-full bg-black px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {busyAction === 'restart' ? '准备新闯关…' : '再来一局'}
          </button>
        )}
        <span className="text-[12px] leading-5 text-[#888]">
          {passed
            ? '卡片只会提炼你在这次对话中亲口讲过的内容。'
            : '这次不会生成观点卡片，下一局可以换一种说法。'}
        </span>
      </div>
    </ResultShell>
  );
}

function ResultShell({
  tone,
  eyebrow,
  title,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral';
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    success: 'border-[#cfe4d5] bg-white',
    warning: 'border-[#e8dbc8] bg-white',
    neutral: 'border-[#e8e4dc] bg-white',
  }[tone];
  const eyebrowClass = {
    success: 'bg-[#eaf5ee] text-[#397750]',
    warning: 'bg-[#f5ebdc] text-[#8b6439]',
    neutral: 'bg-[#f0ebe3] text-[#666]',
  }[tone];

  return (
    <section className={`ml-[50px] max-w-[760px] rounded-2xl border p-6 ${toneClass}`}>
      <span
        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${eyebrowClass}`}
      >
        {eyebrow}
      </span>
      <h2 className="mt-3 text-[20px] font-semibold leading-8 text-[#1a1a1a]">{title}</h2>
      {children}
    </section>
  );
}
