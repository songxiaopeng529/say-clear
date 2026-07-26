'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function initialOf(text: string) {
  return text.trim().slice(0, 1).toUpperCase() || 'S';
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function displayNameOf(metadata: Record<string, unknown> | undefined, email?: string) {
  return (
    metadataString(metadata, 'user_name') ??
    metadataString(metadata, 'full_name') ??
    metadataString(metadata, 'name') ??
    email ??
    '用户'
  );
}

export function AppHeader() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        setDisplayName(user ? displayNameOf(user.user_metadata, user.email) : null);
        setAvatarUrl(metadataString(user?.user_metadata, 'avatar_url'));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="relative h-[68px] border-b border-[#e8e4dc] bg-[#fafaf8]">
      <Link
        href="/"
        className="absolute left-10 top-5 flex h-7 items-start gap-2"
        aria-label="SayClear 首页"
      >
        <span className="text-[22px] font-bold leading-[28px] tracking-[-0.5px]">
          SayClear
        </span>
        <span className="mt-1 rounded-full bg-[#f0ede6] px-2 text-[11px] font-medium leading-5 text-[#8b7355]">
          Beta
        </span>
      </Link>

      <nav className="absolute left-1/2 top-[24.5px] flex -translate-x-1/2 gap-10 text-[15px] leading-[19px] text-[#555]">
        <Link href="/shelf">书架</Link>
        <a href="/#pricing">定价</a>
      </nav>

      <div className="absolute right-10 top-[15.5px] flex h-[37px] items-center gap-4 text-[15px] leading-[19px] text-[#555]">
        {!loaded ? (
          <div className="h-9 w-[102px] animate-pulse rounded-full bg-[#f0ebe3]" />
        ) : displayName ? (
          <>
            <span className="max-w-[140px] truncate">{displayName}</span>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d8a5a] text-[13px] font-bold leading-4 text-white">
                {initialOf(displayName)}
              </span>
            )}
          </>
        ) : (
          <>
            <Link href="/login">登录</Link>
            <Link
              href="/login"
              className="flex h-[37px] w-14 items-center justify-center text-[14px] font-medium leading-[17px] text-[#555]"
            >
              免费开始
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
