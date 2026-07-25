import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { type AiConfig, type AiTask, loadAiConfig } from './config.js';

/**
 * getModel(task) —— 唯一的模型入口。
 * 业务层只按"任务"取模型，内部读 env 决定 provider + modelId。
 * 换 Doubao → DeepSeek → OpenAI 只改 env，业务代码零改动。
 */

let cachedConfig: AiConfig | null = null;
let cachedProvider: ReturnType<typeof createOpenAICompatible> | null = null;

function getProvider() {
  if (!cachedConfig) cachedConfig = loadAiConfig();
  if (!cachedProvider) {
    cachedProvider = createOpenAICompatible({
      name: cachedConfig.provider,
      baseURL: cachedConfig.baseURL,
      apiKey: cachedConfig.apiKey,
    });
  }
  return { config: cachedConfig, provider: cachedProvider };
}

export function getModel(task: AiTask): LanguageModel {
  const { config, provider } = getProvider();
  return provider(config.modelByTask[task]);
}

/**
 * 当前 provider 的 name（= providerOptions 的 key）。
 * providerOptions 必须以 provider name 为键，业务层不该写死 'doubao'，
 * 换 provider 时用此函数保证 key 自动跟随配置。
 */
export function getProviderName(): string {
  const { config } = getProvider();
  return config.provider;
}

/** 测试 / 多租户场景下重置缓存 */
export function resetModelCache(): void {
  cachedConfig = null;
  cachedProvider = null;
}
