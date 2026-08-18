import { generateObject, streamText, type CoreMessage } from 'ai';
import type { LanguageModelV1ProviderMetadata } from '@ai-sdk/provider';
import {
  cardDraftSchema,
  clarityReportContentSchema,
  clarityReportSchema,
  type CardDraft,
  type ClarityReport,
  type ClarityReportContent,
  type TurnJudgment,
  turnJudgmentSchema,
} from '@say-clear/types';
import { getModel, getProviderName } from './model.js';

/** 转发 AI SDK 的消息类型，供 server 使用（避免 server 直接依赖 ai） */
export type { CoreMessage };

/**
 * AI 调用封装 —— 对接费曼 prompt 链 spec §8。
 * prompt 内容由 packages/core 提供（system + messages），此处只负责"怎么调模型"。
 */

/**
 * 关闭模型的深度推理（reasoning）。
 * 豆包 seed 系列是推理模型，默认每次都会产出大段 reasoning_content，实测让
 * clarity-report 从 ~5s 拖到 ~39s（finish 接口"一直 Pending"的真正根因）。
 * 这些任务要的是稳定快速的结构化判定，不需要长链思考，故统一 disabled。
 * key 必须是当前 provider name，用 getProviderName() 保证换 provider 时自动跟随。
 */
function noThinking(): LanguageModelV1ProviderMetadata {
  return { [getProviderName()]: { thinking: { type: 'disabled' } } };
}

/** 阶段② 追问循环：流式返回笨学生的追问 */
export function streamFeynmanReply(params: {
  system: string;
  messages: CoreMessage[];
}) {
  return streamText({
    model: getModel('feynman-chat'),
    system: params.system,
    messages: params.messages,
    temperature: 0.8, // 人设需要一点灵活度
    providerOptions: noThinking(), // 流式对话尤其怕推理拖慢首字
  });
}

/** 阶段②：一次结构化调用同时给出清晰度裁决和下一问。 */
export async function judgeFeynmanTurn(params: {
  system: string;
  prompt: string;
}): Promise<TurnJudgment> {
  const { object } = await generateObject({
    model: getModel('feynman-judge'),
    schema: turnJudgmentSchema,
    mode: 'json',
    providerOptions: noThinking(),
    system: params.system,
    prompt: params.prompt,
    temperature: 0.2,
  });
  return object;
}

/** 阶段③：模型只整理报告文案，不拥有 pass 的决定权。 */
export async function generateClarityReportContent(params: {
  system: string;
  prompt: string;
}): Promise<ClarityReportContent> {
  const { object } = await generateObject({
    model: getModel('clarity-report'),
    schema: clarityReportContentSchema,
    // mode:'json' 走 response_format(json_object) 而非默认 tool_calls；
    // 配合 noThinking() 关推理，实测 ~5s 返回（原 ~39s）。
    mode: 'json',
    providerOptions: noThinking(),
    system: params.system,
    prompt: params.prompt,
    temperature: 0.3, // 判定要稳定
  });
  return object;
}

/**
 * 兼容原有导出名，但 pass 现在必须由调用方根据会话终态传入。
 * 模型响应使用不含 pass 的 schema，因此无法推翻服务端裁决。
 */
export async function generateClarityReport(params: {
  system: string;
  prompt: string;
  pass: boolean;
}): Promise<ClarityReport> {
  const content = await generateClarityReportContent(params);
  return clarityReportSchema.parse({ pass: params.pass, ...content });
}

/** 阶段④ 卡片抽取：结构化输出（铁律：只提炼用户说过的话） */
export async function extractCardDraft(params: {
  system: string;
  prompt: string;
}): Promise<CardDraft> {
  const { object } = await generateObject({
    model: getModel('card-extract'),
    schema: cardDraftSchema,
    mode: 'json',
    providerOptions: noThinking(),
    system: params.system,
    prompt: params.prompt,
    temperature: 0.2, // 忠实提炼，低随机
  });
  return object;
}
