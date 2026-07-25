import type { Provider } from '@say-clear/types';

/**
 * 认证抽象层契约 —— 技术方案 §7。
 * 前端只调统一接口，不感知底层是 Supabase 原生还是微信自建。
 * "能力收口，业务无感"。
 */

/** V1 直接可用的登录方式 */
export type OAuthProvider = Extract<Provider, 'github' | 'google'>;

/** 已认证用户的规范化视图 */
export interface AuthUser {
  userId: string;
  displayName: string | null;
  /** 当前会话使用的登录来源 */
  provider: Provider;
}

/** 一次外部登录产出的原始身份（用于 identity 归并） */
export interface RawIdentity {
  provider: Provider;
  providerUid: string;
  /** ★微信跨端归并锚点；OAuth provider 可为空 */
  unionid?: string | null;
  displayName?: string | null;
}

/** 统一登录接口：不同 provider 由不同实现兑现 */
export interface AuthAdapter {
  /** 发起 OAuth（Supabase 原生：github/google） */
  signInWithOAuth(provider: OAuthProvider): Promise<void>;
  /** 校验请求携带的 token，返回当前用户；无效返回 null */
  verify(token: string): Promise<AuthUser | null>;
  signOut(): Promise<void>;
}
