-- SayClear · RLS 行级隔离策略（技术方案 §5.1）
-- 幂等：可重复执行。给 6 张业务表开启 RLS，并按 auth.uid() 限定属主。
--
-- 说明：后端 Prisma 以 postgres 角色连库会绕过 RLS（业务隔离由 Hono 中间件 userId 过滤兜底）；
-- RLS 是纵深防御，拦截"绕过后端、直接用 anon/authenticated key 访问 PostgREST"的场景。
--
-- 注意：id / userId 列为 text 类型，auth.uid() 返回 uuid，需 ::text 转换。

-- ── Profile（id = auth.users.id）──
alter table "Profile" enable row level security;
drop policy if exists "profile_owner" on "Profile";
create policy "profile_owner" on "Profile"
  for all
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- ── Identity ──
alter table "Identity" enable row level security;
drop policy if exists "identity_owner" on "Identity";
create policy "identity_owner" on "Identity"
  for all
  using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- ── Book ──
alter table "Book" enable row level security;
drop policy if exists "book_owner" on "Book";
create policy "book_owner" on "Book"
  for all
  using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- ── Highlight ──
alter table "Highlight" enable row level security;
drop policy if exists "highlight_owner" on "Highlight";
create policy "highlight_owner" on "Highlight"
  for all
  using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- ── FeynmanSession ──
alter table "FeynmanSession" enable row level security;
drop policy if exists "session_owner" on "FeynmanSession";
create policy "session_owner" on "FeynmanSession"
  for all
  using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- ── OpinionCard ──
alter table "OpinionCard" enable row level security;
drop policy if exists "card_owner" on "OpinionCard";
create policy "card_owner" on "OpinionCard"
  for all
  using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);
