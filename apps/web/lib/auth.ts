import type { AuthUser } from '@say-clear/auth';
import { normalizeProvider } from '@say-clear/auth';
import { ApiError } from './api-error';
import { prisma } from './db';
import { createSupabaseServerClient } from './supabase/server';

function displayNameOf(user: { user_metadata?: Record<string, unknown> }) {
  return (
    (user.user_metadata?.user_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null
  );
}

export async function requireUser(): Promise<AuthUser> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, 'unauthorized', '未登录或会话已过期');
  }

  const authUser: AuthUser = {
    userId: user.id,
    displayName: displayNameOf(user),
    provider: normalizeProvider(user.app_metadata?.provider),
  };

  await prisma.profile.upsert({
    where: { id: authUser.userId },
    create: { id: authUser.userId, displayName: authUser.displayName },
    update: {},
  });

  return authUser;
}
