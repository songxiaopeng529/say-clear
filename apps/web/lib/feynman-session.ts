import type { FeynmanSession, OpinionCard } from '@prisma/client';
import {
  MAX_USER_TURNS as CORE_MAX_USER_TURNS,
  MIN_USER_TURNS_TO_PASS,
} from '@say-clear/core';
import {
  clarityReportSchema,
  turnJudgmentRecordSchema,
  turnJudgmentSchema,
  type SessionDto,
  type SessionProgress,
  type SessionStatus,
  type Turn,
  type TurnJudgment,
  type TurnJudgmentRecord,
} from '@say-clear/types';

export const MIN_USER_TURNS = MIN_USER_TURNS_TO_PASS;
export const MAX_USER_TURNS = CORE_MAX_USER_TURNS;

export type JudgmentOutcome = TurnJudgmentRecord['outcome'];
export type StoredJudgmentRecord = TurnJudgmentRecord;

export type SessionWithOptionalCard = FeynmanSession & {
  card?: Pick<OpinionCard, 'id'> | null;
};

export interface SessionFinalization {
  required: boolean;
  completed: boolean;
}

export type SessionResponseDto = SessionDto & {
  progress: SessionProgress & {
    canAnswer: boolean;
    canAbandon: boolean;
  };
  finalization: SessionFinalization;
  cardId: string | null;
};

export function parseTurns(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Turn[] => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (
      (candidate.role !== 'assistant' && candidate.role !== 'user') ||
      typeof candidate.content !== 'string' ||
      typeof candidate.ts !== 'string'
    ) {
      return [];
    }
    return [
      {
        role: candidate.role,
        content: candidate.content,
        ts: candidate.ts,
      },
    ];
  });
}

export function countUserTurns(turns: Turn[]): number {
  return turns.filter((turn) => turn.role === 'user').length;
}

export function parseStoredJudgments(value: unknown): StoredJudgmentRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StoredJudgmentRecord[] => {
    const parsed = turnJudgmentRecordSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function publicJudgments(value: unknown): TurnJudgmentRecord[] {
  return parseStoredJudgments(value);
}

export function parseFinalJudgment(value: unknown): TurnJudgment | null {
  const result = turnJudgmentSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function getProgress(
  turns: Turn[],
  status: SessionStatus,
): SessionResponseDto['progress'] {
  const userTurnCount = countUserTurns(turns);
  return {
    userTurnCount,
    minUserTurns: MIN_USER_TURNS,
    maxUserTurns: MAX_USER_TURNS,
    canAnswer: status === 'ongoing' && userTurnCount < MAX_USER_TURNS,
    canAbandon: status === 'ongoing',
  };
}

export function getFinalization(
  status: SessionStatus,
  clarityReport: unknown,
): SessionFinalization {
  const required = status === 'passed' || status === 'needs_work';
  return {
    required,
    completed: required && clarityReportSchema.safeParse(clarityReport).success,
  };
}

export function toSessionResponse(
  session: SessionWithOptionalCard,
): SessionResponseDto {
  const turns = parseTurns(session.turns);
  const status = session.status as SessionStatus;
  const reportResult = clarityReportSchema.safeParse(session.clarityReport);
  const clarityReport = reportResult.success
    ? {
        ...reportResult.data,
        // The persisted terminal state is authoritative even for legacy rows.
        pass:
          status === 'passed'
            ? true
            : status === 'needs_work'
              ? false
              : reportResult.data.pass,
      }
    : null;

  return {
    id: session.id,
    bookId: session.bookId,
    status,
    turns,
    clarityReport,
    flowVersion: session.flowVersion,
    version: session.version,
    judgments: publicJudgments(session.judgments),
    finalJudgment: parseFinalJudgment(session.finalJudgment),
    progress: getProgress(turns, status),
    finalization: getFinalization(status, clarityReport),
    cardId: session.card?.id ?? null,
  };
}
