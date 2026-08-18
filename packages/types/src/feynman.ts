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

/** 单轮回答在五个清晰度维度上的结构化诊断。 */
export const assessmentLevelSchema = z.enum([
  'clear',
  'unclear',
  'not_applicable',
]);
export type AssessmentLevel = z.infer<typeof assessmentLevelSchema>;

export const highlightConsistencySchema = z.enum([
  'consistent',
  'conflict',
  'not_applicable',
]);
export type HighlightConsistency = z.infer<
  typeof highlightConsistencySchema
>;

export const turnAssessmentSchema = z
  .object({
    coreIdea: z.enum(['clear', 'unclear']),
    keyTerms: assessmentLevelSchema,
    logicChain: assessmentLevelSchema,
    highlightConsistency: highlightConsistencySchema,
    ownExample: assessmentLevelSchema,
  })
  .strict();
export type TurnAssessment = z.infer<typeof turnAssessmentSchema>;

export const blockingIssueSchema = z
  .object({
    signal: claritySignalSchema,
    /** 必须逐字来自用户对话；服务端还需校验它确实是原文子串。 */
    evidenceQuote: z.string().min(1),
    explanation: z.string().min(1),
  })
  .strict();
export type BlockingIssue = z.infer<typeof blockingIssueSchema>;

export const nextProbeSchema = z
  .object({
    kind: z.enum(['clarification', 'verification']),
    question: z.string().min(1),
  })
  .strict();
export type NextProbe = z.infer<typeof nextProbeSchema>;

/**
 * 每次用户回答后的唯一模型裁决契约。
 *
 * 跨字段约束：
 * - clear 不得虚构阻塞问题；若需要最低轮次验证，只能给 verification。
 * - unclear 必须给出一个且仅一个阻塞问题；若继续追问，只能给 clarification。
 * - nextProbe 能否为空由服务端结合当前轮次通过 resolveJudgedTurn 再校验。
 */
export const turnJudgmentSchema = z
  .object({
    clarity: z.enum(['clear', 'unclear']),
    assessment: turnAssessmentSchema,
    blockingIssue: blockingIssueSchema.nullable(),
    nextProbe: nextProbeSchema.nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.clarity === 'clear' && value.blockingIssue !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blockingIssue'],
        message: 'clear 裁决不能包含 blockingIssue',
      });
    }
    if (value.clarity === 'unclear' && value.blockingIssue === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blockingIssue'],
        message: 'unclear 裁决必须包含 blockingIssue',
      });
    }
    const unclearDimensions = [
      value.assessment.coreIdea === 'unclear',
      value.assessment.keyTerms === 'unclear',
      value.assessment.logicChain === 'unclear',
      value.assessment.highlightConsistency === 'conflict',
      value.assessment.ownExample === 'unclear',
    ];
    if (value.clarity === 'clear' && unclearDimensions.some(Boolean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assessment'],
        message: 'clear 裁决不能包含 unclear 或 conflict 维度',
      });
    }
    if (value.clarity === 'unclear' && !unclearDimensions.some(Boolean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assessment'],
        message: 'unclear 裁决必须至少包含一个 unclear 或 conflict 维度',
      });
    }
    const signalMatchesAssessment = {
      vague:
        value.assessment.coreIdea === 'unclear' ||
        value.assessment.keyTerms === 'unclear',
      jargon: value.assessment.keyTerms === 'unclear',
      logic_gap: value.assessment.logicChain === 'unclear',
      mismatch_highlight:
        value.assessment.highlightConsistency === 'conflict',
      no_example: value.assessment.ownExample === 'unclear',
    } as const;
    if (
      value.blockingIssue &&
      !signalMatchesAssessment[value.blockingIssue.signal]
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blockingIssue', 'signal'],
        message: 'blockingIssue.signal 必须与 assessment 中的未清晰维度一致',
      });
    }
    if (
      value.nextProbe &&
      value.clarity === 'clear' &&
      value.nextProbe.kind !== 'verification'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nextProbe', 'kind'],
        message: 'clear 裁决只能使用 verification 追问',
      });
    }
    if (
      value.nextProbe &&
      value.clarity === 'unclear' &&
      value.nextProbe.kind !== 'clarification'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nextProbe', 'kind'],
        message: 'unclear 裁决只能使用 clarification 追问',
      });
    }
  });
export type TurnJudgment = z.infer<typeof turnJudgmentSchema>;

/** 持久化的裁决记录；保留发生轮次和时间用于回放与评估。 */
export const turnJudgmentRecordSchema = z
  .object({
    requestId: z.string().uuid(),
    userTurnCount: z.number().int().min(1),
    judgment: turnJudgmentSchema,
    outcome: z.enum(['continue', 'passed', 'needs_work']),
    createdAt: z.string(),
  })
  .strict();
export type TurnJudgmentRecord = z.infer<typeof turnJudgmentRecordSchema>;

/** 报告模型只生成文案，不能重新决定是否通关。 */
export const clarityReportContentSchema = z
  .object({
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
  })
  .strict();
export type ClarityReportContent = z.infer<typeof clarityReportContentSchema>;

/** 清晰度体检报告（pass 只能由服务端依据终态组合） */
export const clarityReportSchema = z
  .object({
    pass: z.boolean(),
    ...clarityReportContentSchema.shape,
  })
  .strict();
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
