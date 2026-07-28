import { describe, expect, it } from 'vitest';
import { turnJudgmentSchema, type TurnJudgment } from '@say-clear/types';
import {
  isJudgmentEvidenceGrounded,
  nextState,
  resolveJudgedTurn,
} from './state-machine.js';

const assessment: TurnJudgment['assessment'] = {
  coreIdea: 'clear',
  keyTerms: 'clear',
  logicChain: 'clear',
  highlightConsistency: 'consistent',
  ownExample: 'clear',
};

function clearJudgment(withProbe: boolean): TurnJudgment {
  return {
    clarity: 'clear',
    assessment,
    blockingIssue: null,
    nextProbe: withProbe
      ? { kind: 'verification', question: '能换个场景再说一次吗？' }
      : null,
  };
}

function unclearJudgment(withProbe: boolean): TurnJudgment {
  return {
    clarity: 'unclear',
    assessment: { ...assessment, logicChain: 'unclear' },
    blockingIssue: {
      signal: 'logic_gap',
      evidenceQuote: '所以它就会成功',
      explanation: '从原因直接跳到了结果。',
    },
    nextProbe: withProbe
      ? { kind: 'clarification', question: '中间具体发生了什么呀？' }
      : null,
  };
}

describe('resolveJudgedTurn', () => {
  it.each([
    [1, clearJudgment(true), 'continue'],
    [1, unclearJudgment(true), 'continue'],
    [2, clearJudgment(false), 'passed'],
    [2, unclearJudgment(true), 'continue'],
    [3, clearJudgment(false), 'passed'],
    [3, unclearJudgment(false), 'needs_work'],
  ] as const)('第 %i 次回答 + %s => %s', (userTurnCount, judgment, outcome) => {
    expect(resolveJudgedTurn({ userTurnCount, judgment }).outcome).toBe(outcome);
  });

  it('继续时缺少追问会失败，而终局会忽略多余追问', () => {
    expect(() =>
      resolveJudgedTurn({ userTurnCount: 1, judgment: clearJudgment(false) }),
    ).toThrow('nextProbe.question');
    expect(
      resolveJudgedTurn({ userTurnCount: 3, judgment: unclearJudgment(true) }),
    ).toEqual({
      outcome: 'needs_work',
      status: 'needs_work',
      nextQuestion: null,
    });
  });

  it('拒绝越界轮次', () => {
    expect(() =>
      resolveJudgedTurn({ userTurnCount: 0, judgment: clearJudgment(true) }),
    ).toThrow(RangeError);
    expect(() =>
      resolveJudgedTurn({ userTurnCount: 4, judgment: clearJudgment(false) }),
    ).toThrow(RangeError);
  });
});

describe('turnJudgmentSchema', () => {
  it('拒绝 unclear 却没有阻塞证据', () => {
    expect(
      turnJudgmentSchema.safeParse({
        ...unclearJudgment(true),
        blockingIssue: null,
      }).success,
    ).toBe(false);
  });

  it('拒绝 clear 却生成澄清式追问', () => {
    expect(
      turnJudgmentSchema.safeParse({
        ...clearJudgment(true),
        nextProbe: { kind: 'clarification', question: '为什么？' },
      }).success,
    ).toBe(false);
  });

  it('拒绝整体结论与五维诊断自相矛盾', () => {
    expect(
      turnJudgmentSchema.safeParse({
        ...clearJudgment(false),
        assessment: {
          ...assessment,
          highlightConsistency: 'conflict',
        },
      }).success,
    ).toBe(false);
    expect(
      turnJudgmentSchema.safeParse({
        ...unclearJudgment(true),
        assessment,
      }).success,
    ).toBe(false);
  });

  it('拒绝阻塞信号与未清晰维度不一致', () => {
    expect(
      turnJudgmentSchema.safeParse({
        ...unclearJudgment(true),
        blockingIssue: {
          signal: 'no_example',
          evidenceQuote: '所以它就会成功',
          explanation: '没有给出自己的例子。',
        },
      }).success,
    ).toBe(false);
  });
});

describe('isJudgmentEvidenceGrounded', () => {
  it('只接受用户原话中的逐字证据', () => {
    const judgment = unclearJudgment(true);
    expect(
      isJudgmentEvidenceGrounded(judgment, ['因为 A，所以它就会成功。']),
    ).toBe(true);
    expect(isJudgmentEvidenceGrounded(judgment, ['模型自己编的证据'])).toBe(
      false,
    );
  });
});

describe('terminal state guards', () => {
  it('needs_work 和 abandoned 都不能进入观点卡片阶段', () => {
    expect(nextState('NEEDS_WORK', { type: 'GO_CARD' })).toBe('NEEDS_WORK');
    expect(nextState('ABANDONED', { type: 'GO_CARD' })).toBe('ABANDONED');
    expect(nextState('PASSED', { type: 'GO_CARD' })).toBe('CARD_DRAFT');
  });
});
