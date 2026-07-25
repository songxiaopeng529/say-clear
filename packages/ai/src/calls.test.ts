import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractCardDraft,
  generateClarityReport,
  resetModelCache,
} from './index.js';

/**
 * 单元测试（默认跑，无需密钥/网络）——回归护栏。
 * 核心断言：clarity-report / card-extract 发出的请求确实带上了
 *   - thinking: { type: 'disabled' }  （关推理，本次 finish 卡死的修复）
 *   - response_format: { type: 'json_object' }（mode:'json' 而非慢的 tool_calls）
 * 防止日后有人误删 noThinking()/mode:'json' 又退回 ~39s 卡死。
 */

// 构造一个 OpenAI 兼容的 chat.completion 假响应，content 为合法 JSON 字符串。
function fakeChatCompletion(contentObj: unknown): Response {
  const body = {
    id: 'test-id',
    object: 'chat.completion',
    created: 0,
    model: 'ep-test',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: JSON.stringify(contentObj) },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

let capturedBody: any;

beforeEach(() => {
  capturedBody = undefined;
  // 关键：用 doubao 作为 provider name，验证 providerOptions 的 key 会跟随 name。
  process.env.AI_PROVIDER = 'doubao';
  process.env.AI_BASE_URL = 'https://example.test/api/v3';
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_MODEL_FEYNMAN = 'ep-test-feynman';
  process.env.AI_MODEL_REPORT = 'ep-test-report';
  resetModelCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateClarityReport（清晰度报告）', () => {
  it('请求带 thinking:disabled 且 response_format 为 json_object', async () => {
    const report = {
      pass: true,
      oneLineVerdict: '讲得很清楚',
      greenPoints: [{ point: '抓住核心', why: '逻辑对齐原文' }],
      redPoints: [],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(String((init as RequestInit).body));
      return fakeChatCompletion(report);
    });

    const result = await generateClarityReport({
      system: '你是阅读教练',
      prompt: '用户讲解……',
    });

    // 1) 关推理：thinking.disabled 必须发出（本次修复的核心）
    expect(capturedBody.thinking).toEqual({ type: 'disabled' });
    // 2) 走 json_object，而非 tool_calls（不应出现 tools/tool_choice）
    expect(capturedBody.response_format).toEqual({ type: 'json_object' });
    expect(capturedBody.tools).toBeUndefined();
    expect(capturedBody.tool_choice).toBeUndefined();
    // 3) 结构化输出能被正确解析回领域对象
    expect(result).toEqual(report);
  });
});

describe('extractCardDraft（卡片抽取）', () => {
  it('同样关推理并走 json_object', async () => {
    const draft = {
      coreOpinion: '痛苦加反思等于进步',
      myExample: '我复盘了搞砸的项目',
      unclearPoints: null,
      sourceQuotes: ['遇到痛苦别逃'],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(String((init as RequestInit).body));
      return fakeChatCompletion(draft);
    });

    const result = await extractCardDraft({
      system: '只提炼用户说过的话',
      prompt: '对话记录……',
    });

    expect(capturedBody.thinking).toEqual({ type: 'disabled' });
    expect(capturedBody.response_format).toEqual({ type: 'json_object' });
    expect(result).toEqual(draft);
  });
});
