import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';
import {
  clarityReportContentSchema,
  turnJudgmentSchema,
} from '@say-clear/types';
import {
  generateClarityReportContent,
  judgeFeynmanTurn,
  resetModelCache,
} from './index.js';

/**
 * 集成测试（默认 SKIP）——打真实豆包端点，验证：
 *   1) 结构化输出符合 clarityReportContentSchema
 *   2) 关推理后延迟在阈值内（本次 finish 卡死修复的实证）
 * 开启方式：RUN_AI_INTEGRATION=1 pnpm --filter @say-clear/ai test
 * 需根 .env 提供 AI_BASE_URL / AI_API_KEY / AI_MODEL_*。
 */

const RUN = process.env.RUN_AI_INTEGRATION === '1';

// 从 monorepo 根 .env 注入（仅补齐尚未设置的键）。
function loadRootEnv() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];
  for (const p of candidates) {
    try {
      for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        const v = m[2].trim().replace(/^["']|["']$/g, '');
        if (process.env[m[1]] === undefined) process.env[m[1]] = v;
      }
    } catch {
      /* 文件不存在则跳过 */
    }
  }
}

describe.skipIf(!RUN)('generateClarityReportContent（真实豆包集成）', () => {
  beforeAll(() => {
    loadRootEnv();
    resetModelCache();
  });

  it('真实模型返回符合 schema，且在 20s 内完成', async () => {
    const t0 = Date.now();
    const report = await generateClarityReportContent({
      system:
        '你是阅读教练，判定用户是否把观点讲清楚了。偏宽松鼓励。只输出结构化 JSON。',
      prompt:
        '书《原则》。划线"痛苦+反思=进步"。用户："遇到痛苦别逃，事后复盘就能变强，我上次搞砸项目复盘后就没再犯。" 给出清晰度报告。',
    });
    const elapsed = Date.now() - t0;

    // 结构合法（schema 校验通过即抛不出）
    expect(() => clarityReportContentSchema.parse(report)).not.toThrow();
    expect(report.greenPoints.length).toBeGreaterThanOrEqual(1);
    // 关推理后应远快于原 ~39s；给足余量设 20s 阈值
    expect(elapsed).toBeLessThan(20_000);
    // eslint-disable-next-line no-console
    console.log(`[integration] 真实耗时 ${elapsed}ms`);
  });

  it('真实裁决模型返回自洽的结构化判断，且在 20s 内完成', async () => {
    const t0 = Date.now();
    const judgment = await judgeFeynmanTurn({
      system:
        '你只判断表达是否清楚。若 unclear，assessment 至少一项 unclear，blockingIssue.signal 必须对应该维度，证据逐字来自用户。',
      prompt:
        '用户说：“这本书就是讲成长，反正想明白了就会变好。”这是第 2 次回答；若 unclear，请给一个 clarification 追问。',
    });
    const elapsed = Date.now() - t0;

    expect(() => turnJudgmentSchema.parse(judgment)).not.toThrow();
    expect(elapsed).toBeLessThan(20_000);
    // eslint-disable-next-line no-console
    console.log(`[integration] 裁决真实耗时 ${elapsed}ms`);
  });
});
