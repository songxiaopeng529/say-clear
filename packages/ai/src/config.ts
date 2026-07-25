/**
 * 模型抽象层配置 —— 全部从 env 读取，业务代码永不出现模型名。
 * 技术方案 §6：配置驱动 / OpenAI 兼容接入 / 用户侧零入口。
 */

/** 业务只认 task，不认具体模型 */
export type AiTask = 'feynman-chat' | 'clarity-report' | 'card-extract';

export interface AiConfig {
  provider: string;
  baseURL: string;
  apiKey: string;
  /** 每个 task 映射到一个模型 id（火山方舟为 endpoint id） */
  modelByTask: Record<AiTask, string>;
}

/** 读取并校验 env，缺失时快速失败（仅 server 侧调用） */
export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = env.AI_PROVIDER ?? 'doubao';
  const baseURL = env.AI_BASE_URL;
  const apiKey = env.AI_API_KEY;

  if (!baseURL) throw new Error('[ai] 缺少环境变量 AI_BASE_URL');
  if (!apiKey) throw new Error('[ai] 缺少环境变量 AI_API_KEY');

  const feynman = env.AI_MODEL_FEYNMAN;
  if (!feynman) throw new Error('[ai] 缺少环境变量 AI_MODEL_FEYNMAN');
  // 报告/抽取默认复用费曼模型，可分别用 env 覆盖
  const report = env.AI_MODEL_REPORT ?? feynman;

  return {
    provider,
    baseURL,
    apiKey,
    modelByTask: {
      'feynman-chat': feynman,
      'clarity-report': report,
      'card-extract': report,
    },
  };
}
