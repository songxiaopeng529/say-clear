import { z } from 'zod';

/**
 * 费曼闯关的结构化输出契约 —— 与 reading-coach-feynman-prompt-spec.md §5.2 / §6.2 同源。
 * 这些 schema 同时被 packages/ai(generateObject) 与前端渲染共用。
 */

/** 五类"内化失败信号"（spec §2） */
export const claritySignalSchema = z.enum([
  'vague', // 含糊
  'jargon', // 术语堆砌
  'logic_gap', // 逻辑跳跃
  'mismatch_highlight', // 与划线不自洽
  'no_example', // 无自己的例子
]);
export type ClaritySignal = z.infer<typeof claritySignalSchema>;

/** 清晰度体检报告（spec §5.2） */
export const clarityReportSchema = z.object({
  /** 是否通关（偏宽松鼓励） */
  pass: z.boolean(),
  /** 一句话鼓励式总评 */
  oneLineVerdict: z.string(),
  /** 讲清了的点（绿点） */
  greenPoints: z
    .array(
      z.object({
        point: z.string(),
        why: z.string(),
      }),
    )
    .min(1),
  /** 一问就垮的盲区（红点，可为空） */
  redPoints: z.array(
    z.object({
      point: z.string(),
      signal: claritySignalSchema,
      /** 温和的"可以再想想"提示，不给答案 */
      gentleHint: z.string(),
    }),
  ),
});
export type ClarityReport = z.infer<typeof clarityReportSchema>;

/** 卡片草稿（spec §6.2，铁律：只提炼用户说过的话） */
export const cardDraftSchema = z.object({
  coreOpinion: z.string(),
  myExample: z.string().nullable(),
  unclearPoints: z.string().nullable(),
  /** 溯源：本卡片提炼自用户的哪几句原话 */
  sourceQuotes: z.array(z.string()),
});
export type CardDraft = z.infer<typeof cardDraftSchema>;
