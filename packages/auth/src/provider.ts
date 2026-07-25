import type { Provider } from '@say-clear/types';

/** 把 Supabase 的 app_metadata.provider 归一到我们的 Provider 枚举。 */
export function normalizeProvider(raw: unknown): Provider {
  switch (raw) {
    case 'github':
      return 'github';
    case 'google':
      return 'google';
    default:
      // 兜底：未知来源按 github 处理（V1 只开了 github）。
      return 'github';
  }
}
