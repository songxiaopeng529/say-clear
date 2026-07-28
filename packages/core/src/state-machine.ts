import type { SessionStatus, Turn, TurnJudgment } from '@say-clear/types';

/**
 * 费曼追问状态机 —— 端无关纯逻辑（spec §8.3 + §4.2 轮次控制）。
 * V2 小程序原样复用；不依赖任何前端/后端框架。
 */

export type FeynmanState =
  | 'INIT'
  | 'FIRST_QUESTION'
  | 'PROBING'
  | 'PASSED'
  | 'NEEDS_WORK'
  | 'ABANDONED'
  | 'REPORT'
  | 'CARD_DRAFT';

/** 用户回答次数硬上限。 */
export const MAX_PROBING_TURNS = 3;
/** 至少完成两次用户回答，模型才有权判定通关。 */
export const MIN_PROBING_TURNS = 2;
export const MIN_USER_TURNS_TO_PASS = MIN_PROBING_TURNS;
export const MAX_USER_TURNS = MAX_PROBING_TURNS;

/** 统计对话中用户回答的轮数（= PROBING 已进行的轮数） */
export function countUserTurns(turns: Turn[]): number {
  return turns.filter((t) => t.role === 'user').length;
}

/**
 * 判断收到用户新回答后，应继续追问还是进入报告阶段。
 * @param userTurnCount 用户已回答的轮数（含刚提交这轮）
 * @param hasStrongSignal 本轮回答是否仍命中"强信号"（由调用方基于内容判断，可选）
 */
export function shouldContinueProbing(
  userTurnCount: number,
  hasStrongSignal = true,
): boolean {
  if (userTurnCount >= MAX_PROBING_TURNS) return false; // 到顶必给结果
  if (userTurnCount >= MIN_PROBING_TURNS && !hasStrongSignal) return false; // 早停
  return true;
}

export type ResolvedJudgedTurn =
  | {
      outcome: 'continue';
      status: Extract<SessionStatus, 'ongoing'>;
      nextQuestion: string;
    }
  | {
      outcome: 'passed';
      status: Extract<SessionStatus, 'passed'>;
      nextQuestion: null;
    }
  | {
      outcome: 'needs_work';
      status: Extract<SessionStatus, 'needs_work'>;
      nextQuestion: null;
    };

/**
 * 把模型的语义判断解析为唯一流程结果。
 * 模型负责 clear / unclear；服务端负责最低轮次、最高轮次和终态。
 */
export function resolveJudgedTurn(params: {
  userTurnCount: number;
  judgment: TurnJudgment;
}): ResolvedJudgedTurn {
  const { userTurnCount, judgment } = params;
  if (
    !Number.isInteger(userTurnCount) ||
    userTurnCount < 1 ||
    userTurnCount > MAX_USER_TURNS
  ) {
    throw new RangeError(
      `userTurnCount 必须是 1 到 ${MAX_USER_TURNS} 之间的整数`,
    );
  }

  if (userTurnCount >= MIN_USER_TURNS_TO_PASS && judgment.clarity === 'clear') {
    return { outcome: 'passed', status: 'passed', nextQuestion: null };
  }

  if (userTurnCount >= MAX_USER_TURNS) {
    return {
      outcome: 'needs_work',
      status: 'needs_work',
      nextQuestion: null,
    };
  }

  const question = judgment.nextProbe?.question.trim();
  if (!question) {
    throw new Error('继续闯关时模型必须提供 nextProbe.question');
  }
  return { outcome: 'continue', status: 'ongoing', nextQuestion: question };
}

/** 校验模型给出的证据确实逐字来自某一轮用户原话。 */
export function isJudgmentEvidenceGrounded(
  judgment: TurnJudgment,
  userMessages: readonly string[],
): boolean {
  const quote = judgment.blockingIssue?.evidenceQuote;
  if (!quote) return judgment.clarity === 'clear';
  return userMessages.some((message) => message.includes(quote));
}

/** 计算下一个状态（不含副作用，纯函数） */
export function nextState(
  current: FeynmanState,
  event:
    | { type: 'START'; hasHighlights: boolean }
    | { type: 'USER_ANSWER'; userTurnCount: number; hasStrongSignal?: boolean }
    | { type: 'PASS' }
    | { type: 'GO_CARD' },
): FeynmanState {
  switch (current) {
    case 'INIT':
      return event.type === 'START' ? 'FIRST_QUESTION' : current;
    case 'FIRST_QUESTION':
      return event.type === 'USER_ANSWER' ? 'PROBING' : current;
    case 'PROBING':
      if (event.type === 'USER_ANSWER') {
        return shouldContinueProbing(
          event.userTurnCount,
          event.hasStrongSignal ?? true,
        )
          ? 'PROBING'
          : 'REPORT';
      }
      if (event.type === 'PASS') return 'PASSED';
      return current;
    case 'PASSED':
    case 'REPORT':
      return event.type === 'GO_CARD' ? 'CARD_DRAFT' : current;
    case 'NEEDS_WORK':
    case 'ABANDONED':
    case 'CARD_DRAFT':
      return current;
    default:
      return current;
  }
}

/** 把 turns 渲染成给报告/抽取用的对话文本 */
export function renderConversation(turns: Turn[]): string {
  return turns
    .map((t) => `${t.role === 'user' ? '用户' : '笨学生'}：${t.content}`)
    .join('\n');
}
