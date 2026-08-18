/**
 * 领域实体类型 —— 与 prisma/schema.prisma 保持同源。
 * 这些是前后端共享的核心数据结构。
 */

import type {
  ClarityReport,
  TurnJudgment,
  TurnJudgmentRecord,
} from './feynman.js';

export type Provider = 'github' | 'google' | 'wechat_web' | 'wechat_mp';
export type BookStatus = 'reading' | 'done';
export type HighlightSource = 'text' | 'ocr' | 'import';
export type SessionStatus =
  | 'ongoing'
  | 'passed'
  | 'needs_work'
  | 'abandoned';

export interface Profile {
  id: string;
  displayName: string | null;
  createdAt: string;
}

export interface Identity {
  id: string;
  userId: string;
  provider: Provider;
  providerUid: string;
  /** ★微信跨端归并的唯一锚点 */
  unionid: string | null;
  createdAt: string;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  author: string | null;
  status: BookStatus;
  createdAt: string;
}

/** 划线原文 = 本场费曼闯关的局部 ground truth */
export interface Highlight {
  id: string;
  bookId: string;
  userId: string;
  content: string;
  sourceType: HighlightSource;
  createdAt: string;
}

/** 对话中的单轮 */
export interface Turn {
  role: 'assistant' | 'user';
  content: string;
  ts: string;
}

export interface FeynmanSession {
  id: string;
  bookId: string;
  userId: string;
  status: SessionStatus;
  turns: Turn[];
  clarityReport: ClarityReport | null;
  flowVersion: number;
  version: number;
  judgments: TurnJudgmentRecord[];
  finalJudgment: TurnJudgment | null;
  startedAt: string;
  finishedAt: string | null;
}

/** 观点卡片：用户自己的话（铁律：非 AI 总结） */
export interface OpinionCard {
  id: string;
  bookId: string;
  sessionId: string;
  userId: string;
  coreOpinion: string;
  myExample: string | null;
  unclearPoints: string | null;
  createdAt: string;
  updatedAt: string;
}
