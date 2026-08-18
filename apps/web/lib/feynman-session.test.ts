import { describe, expect, it } from 'vitest';

import type { SessionStatus, Turn, TurnJudgment } from '@say-clear/types';

import {
  getFinalization,
  getProgress,
  parseStoredJudgments,
  parseTurns,
  toSessionResponse,
  type SessionWithOptionalCard,
} from './feynman-session';

const assistantTurn: Turn = {
  role: 'assistant',
  content: '请先用自己的话讲讲这本书。',
  ts: '2026-07-27T01:00:00.000Z',
};

const userTurn: Turn = {
  role: 'user',
  content: '我认为核心观点是把复杂问题拆小。',
  ts: '2026-07-27T01:01:00.000Z',
};

const clearJudgment: TurnJudgment = {
  clarity: 'clear',
  assessment: {
    coreIdea: 'clear',
    keyTerms: 'clear',
    logicChain: 'clear',
    highlightConsistency: 'consistent',
    ownExample: 'clear',
  },
  blockingIssue: null,
  nextProbe: null,
};

const unclearJudgment: TurnJudgment = {
  clarity: 'unclear',
  assessment: {
    coreIdea: 'unclear',
    keyTerms: 'clear',
    logicChain: 'unclear',
    highlightConsistency: 'not_applicable',
    ownExample: 'not_applicable',
  },
  blockingIssue: {
    signal: 'logic_gap',
    evidenceQuote: '把复杂问题拆小',
    explanation: '还没有说明拆小为什么有帮助。',
  },
  nextProbe: {
    kind: 'clarification',
    question: '拆小以后，具体会发生什么变化？',
  },
};

const validReport = {
  pass: true,
  oneLineVerdict: '已经能让没读过书的人理解。',
  greenPoints: [
    {
      point: '核心观点明确',
      why: '使用了自己的话说明。',
    },
  ],
  redPoints: [],
};

function makeSession(
  overrides: Record<string, unknown> = {},
): SessionWithOptionalCard {
  return {
    id: 'session-1',
    bookId: 'book-1',
    userId: 'user-1',
    status: 'ongoing',
    turns: [assistantTurn, userTurn],
    clarityReport: null,
    flowVersion: 2,
    version: 3,
    judgments: [],
    finalJudgment: null,
    processingRequestId: null,
    processingStartedAt: null,
    startedAt: new Date('2026-07-27T01:00:00.000Z'),
    finishedAt: null,
    card: null,
    ...overrides,
  } as unknown as SessionWithOptionalCard;
}

describe('parseTurns', () => {
  it.each([undefined, null, '[]', 42, {}])(
    'returns an empty list for non-array value %j',
    (value) => {
      expect(parseTurns(value)).toEqual([]);
    },
  );

  it('keeps valid legacy turns and filters malformed entries', () => {
    expect(
      parseTurns([
        assistantTurn,
        null,
        { role: 'system', content: 'ignore me', ts: assistantTurn.ts },
        { role: 'user', content: 123, ts: userTurn.ts },
        { role: 'user', content: 'missing timestamp' },
        { ...userTurn, legacyMetadata: 'is ignored' },
      ]),
    ).toEqual([assistantTurn, userTurn]);
  });
});

describe('parseStoredJudgments', () => {
  const validRecord = {
    requestId: '00000000-0000-4000-8000-000000000001',
    userTurnCount: 2,
    judgment: unclearJudgment,
    outcome: 'continue',
    createdAt: '2026-07-27T01:02:00.000Z',
  };

  it.each([undefined, null, '{}', {}, 1])(
    'returns an empty list for non-array value %j',
    (value) => {
      expect(parseStoredJudgments(value)).toEqual([]);
    },
  );

  it('returns valid records and drops corrupt or schema-incompatible records', () => {
    expect(
      parseStoredJudgments([
        validRecord,
        { ...validRecord, requestId: 'not-a-uuid' },
        { ...validRecord, outcome: 'passed', extra: true },
        {
          ...validRecord,
          judgment: { ...unclearJudgment, blockingIssue: null },
        },
      ]),
    ).toEqual([validRecord]);
  });
});

describe('getProgress', () => {
  const twoAnswers = [assistantTurn, userTurn, assistantTurn, userTurn];
  const threeAnswers = [...twoAnswers, assistantTurn, userTurn];

  it('allows an ongoing session to answer before the hard turn limit', () => {
    expect(getProgress(twoAnswers, 'ongoing')).toEqual({
      userTurnCount: 2,
      minUserTurns: 2,
      maxUserTurns: 3,
      canAnswer: true,
      canAbandon: true,
    });
  });

  it('stops an ongoing session at the hard turn limit', () => {
    expect(getProgress(threeAnswers, 'ongoing')).toEqual({
      userTurnCount: 3,
      minUserTurns: 2,
      maxUserTurns: 3,
      canAnswer: false,
      canAbandon: true,
    });
  });

  it.each<SessionStatus>(['passed', 'needs_work', 'abandoned'])(
    'locks answering and abandoning for terminal status %s',
    (status) => {
      expect(getProgress([assistantTurn, userTurn], status)).toMatchObject({
        userTurnCount: 1,
        canAnswer: false,
        canAbandon: false,
      });
    },
  );
});

describe('getFinalization', () => {
  it.each<SessionStatus>(['passed', 'needs_work'])(
    'requires finalization for %s and recognizes a valid report',
    (status) => {
      expect(getFinalization(status, validReport)).toEqual({
        required: true,
        completed: true,
      });
    },
  );

  it('keeps terminal finalization pending for an invalid report', () => {
    expect(getFinalization('needs_work', { pass: false })).toEqual({
      required: true,
      completed: false,
    });
  });

  it.each<SessionStatus>(['ongoing', 'abandoned'])(
    'does not finalize status %s even when a report exists',
    (status) => {
      expect(getFinalization(status, validReport)).toEqual({
        required: false,
        completed: false,
      });
    },
  );
});

describe('toSessionResponse', () => {
  it.each([
    {
      status: 'ongoing' as const,
      canAnswer: true,
      canAbandon: true,
      required: false,
    },
    {
      status: 'passed' as const,
      canAnswer: false,
      canAbandon: false,
      required: true,
    },
    {
      status: 'needs_work' as const,
      canAnswer: false,
      canAbandon: false,
      required: true,
    },
    {
      status: 'abandoned' as const,
      canAnswer: false,
      canAbandon: false,
      required: false,
    },
  ])(
    'maps $status session state and controls to its public DTO',
    ({ status, canAnswer, canAbandon, required }) => {
      const response = toSessionResponse(makeSession({ status }));

      expect(response.status).toBe(status);
      expect(response.progress).toMatchObject({ canAnswer, canAbandon });
      expect(response.finalization).toEqual({
        required,
        completed: false,
      });
    },
  );

  it('uses terminal status as the authority for legacy report pass values', () => {
    const passed = toSessionResponse(
      makeSession({
        status: 'passed',
        flowVersion: 1,
        clarityReport: { ...validReport, pass: false },
      }),
    );
    const needsWork = toSessionResponse(
      makeSession({
        status: 'needs_work',
        flowVersion: 1,
        clarityReport: { ...validReport, pass: true },
      }),
    );
    const ongoing = toSessionResponse(
      makeSession({
        status: 'ongoing',
        flowVersion: 1,
        clarityReport: { ...validReport, pass: false },
      }),
    );

    expect(passed.clarityReport?.pass).toBe(true);
    expect(passed.finalization).toEqual({ required: true, completed: true });
    expect(needsWork.clarityReport?.pass).toBe(false);
    expect(needsWork.finalization).toEqual({
      required: true,
      completed: true,
    });
    expect(ongoing.clarityReport?.pass).toBe(false);
    expect(ongoing.finalization).toEqual({
      required: false,
      completed: false,
    });
  });

  it('sanitizes corrupt JSON fields without rejecting the session', () => {
    const response = toSessionResponse(
      makeSession({
        status: 'needs_work',
        turns: { role: 'user' },
        clarityReport: { pass: false, oneLineVerdict: 'missing points' },
        judgments: [
          {
            requestId: 'invalid',
            userTurnCount: 3,
            judgment: unclearJudgment,
            outcome: 'needs_work',
            createdAt: '2026-07-27T01:03:00.000Z',
          },
        ],
        finalJudgment: { ...clearJudgment, unexpected: true },
        card: { id: 'card-1' },
      }),
    );

    expect(response.turns).toEqual([]);
    expect(response.judgments).toEqual([]);
    expect(response.finalJudgment).toBeNull();
    expect(response.clarityReport).toBeNull();
    expect(response.finalization).toEqual({
      required: true,
      completed: false,
    });
    expect(response.cardId).toBe('card-1');
  });

  it('preserves valid judgments and a final judgment in the public response', () => {
    const record = {
      requestId: '00000000-0000-4000-8000-000000000002',
      userTurnCount: 2,
      judgment: clearJudgment,
      outcome: 'passed' as const,
      createdAt: '2026-07-27T01:02:00.000Z',
    };

    const response = toSessionResponse(
      makeSession({
        status: 'passed',
        clarityReport: validReport,
        judgments: [record],
        finalJudgment: clearJudgment,
      }),
    );

    expect(response.judgments).toEqual([record]);
    expect(response.finalJudgment).toEqual(clearJudgment);
    expect(response.clarityReport).toEqual(validReport);
    expect(response.finalization).toEqual({ required: true, completed: true });
  });
});
