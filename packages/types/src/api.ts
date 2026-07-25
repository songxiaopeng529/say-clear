import { z } from 'zod';

/**
 * API 契约（DTO）—— 与技术方案 §8.2 的端点表同源。
 * 前端 services 与后端 Hono 路由共用这些 schema 做校验与类型推导。
 */

// POST /books
export const createBookSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().max(100).optional(),
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

// POST /books/:id/highlights
export const createHighlightSchema = z.object({
  content: z.string().min(1).max(2000),
  sourceType: z.enum(['text', 'ocr', 'import']).default('text'),
});
export type CreateHighlightInput = z.infer<typeof createHighlightSchema>;

// POST /sessions/:id/messages —— 用户提交回答（返回为流式，非 JSON）
export const postMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

// PATCH /cards/:id
export const updateCardSchema = z.object({
  coreOpinion: z.string().min(1).optional(),
  myExample: z.string().nullable().optional(),
  unclearPoints: z.string().nullable().optional(),
});
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

/** 统一 API 错误响应 */
export interface ApiError {
  error: string;
  message: string;
}
