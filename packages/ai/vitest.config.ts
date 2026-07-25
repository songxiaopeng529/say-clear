import { defineConfig } from 'vitest/config';

/**
 * packages/ai 测试配置。
 * 单元测试默认跑（mock fetch，无需密钥/网络）；
 * 集成测试用 RUN_AI_INTEGRATION=1 开启，会打真实豆包端点。
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000, // 集成测试要给真实模型留足时间
    environment: 'node',
  },
});
