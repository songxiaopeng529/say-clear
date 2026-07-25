'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: loginError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (loginError) throw loginError;
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">SayClear</h1>
        <p className="mt-3 text-sm text-neutral-500">读完不算数，说清才算懂。</p>
        <button
          onClick={login}
          disabled={loading}
          className="mt-10 w-full rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? '正在跳转 GitHub…' : '用 GitHub 登录'}
        </button>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}
