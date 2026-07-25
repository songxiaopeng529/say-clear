import type { Turn } from '@say-clear/types';

/**
 * 费曼追问状态机 —— 端无关纯逻辑（spec §8.3 + §4.2 轮次控制）。
 * V2 小程序原样复用；不依赖任何前端/后端框架。
 */

export type FeynmanState =
  | 'INIT'
  | 'FIRST_QUESTION'
  | 'PROBING'
  | 'PASSED'
  | 'REPORT'
  | 'CARD_DRAFT';

/** 追问轮数硬上限（spec §0：固定 2–3 轮） */
export const MAX_PROBING_TURNS = 3;
/** 早停下限：至少追问 1 轮才允许提前通关 */
export const MIN_PROBING_TURNS = 1;

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
    case 'REPORT':
    case 'PASSED':
      return event.type === 'GO_CARD' ? 'CARD_DRAFT' : current;
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
