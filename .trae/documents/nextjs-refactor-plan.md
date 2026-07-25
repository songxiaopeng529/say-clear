# SayClear 重构：Taro + Hono → Next.js 全栈单应用

## Context（为什么做这次重构）

SayClear 当前是 **Taro（统一端）+ Hono（独立后端）** 的双 app 架构。用户在完整跑通费曼闭环（登录 → 书架 → 贴划线 → 流式追问 → 清晰度报告 → 观点卡片）后，决定把重心转向 **Web/PC 端**，并判断早期"Taro 统一端"的选型对 Web 不够合适。

新方向（用户明确拍板）：
- **技术栈**：改用 **Next.js 全栈（App Router）**，前端页面 + 后端 API 收进**一个** Next 应用。
- **目录**：`apps/` 下只留一个 Next 应用（`apps/web`）；删除 `apps/client`(Taro) 与 `apps/server`(Hono)。小程序未来单开 Taro 目录（本次不做）。
- **packages**：能复用的复用，不能复用的删干净。
- **认证**：`@supabase/ssr` + cookie（服务端会话、middleware 路由保护、token 自动刷新）。放弃 Bearer + storage。
- **样式**：Tailwind CSS。
- **本次目标**：先做出一个**能跑通的简易 Web 交互页面**走通全链路。PC 精细 UI 用户后续自行设计。

预期结果：一个 `next dev` 即可端到端运行的单体 Web 应用，复用现有全部业务逻辑（含豆包推理提速修复），旧 Taro/Hono 代码彻底移除。

**已确认技术取舍**：Next **14.2** + React **18.3**（与现有 React 版本对齐，`cookies()` 同步 API，MVP 少踩坑）。

---

## 复用/删除矩阵（已盘点验证）

| 项 | 处置 |
|---|---|
| `packages/types`（domain/feynman/api，仅依赖 zod） | ✅ 原样保留 |
| `packages/core`（prompts + state-machine 纯逻辑） | ✅ 原样保留 |
| `packages/ai`（config/model/calls + vitest；**`noThinking()` 提速修复**） | ✅ 原样保留 |
| `packages/config`（tsconfig 预设） | ✅ 原样保留 |
| `packages/auth` | ✂️ 裁剪：删 `wechat.ts`；保留 `types.ts` + `normalizeProvider` |
| `prisma/schema.prisma` + `rls.sql` | ✅ 复用（**不重建库、不 db push**） |
| `apps/client`（Taro 全部） | ❌ 整目录删除 |
| `apps/server`（Hono 全部） | ❌ 整目录删除 |
| 业务逻辑（Prisma 查询 / prompt 编排 / 流式 / ensureProfile / api 契约 / 读流） | ⚠️ 迁移：保留逻辑，只重写传输层 |

---

## 目标目录结构

```
apps/web/
  package.json  next.config.ts  tsconfig.json  next-env.d.ts
  tailwind.config.ts  postcss.config.mjs  middleware.ts
  app/
    globals.css  layout.tsx  page.tsx            # 入口：有会话→/shelf 否则→/login
    login/page.tsx                               # 'use client' GitHub 登录
    auth/callback/route.ts                       # code→session→/shelf
    shelf/page.tsx
    book/new/page.tsx   book/[id]/page.tsx        # 新建书 / 已有书（原 ?new=1/?id= 拆两路由）
    feynman/[sessionId]/page.tsx                  # 'use client' 流式对话
    card/page.tsx
    api/
      books/route.ts                    # GET 列表 / POST 建书
      books/[id]/route.ts               # GET 书详情(含 highlights+cards)
      books/[id]/highlights/route.ts    # POST 贴划线
      books/[id]/sessions/route.ts      # POST 开会话(首问)
      sessions/[id]/route.ts            # GET 会话详情
      sessions/[id]/messages/route.ts   # POST 流式追问
      sessions/[id]/finish/route.ts     # POST 清晰度报告
      sessions/[id]/card/route.ts       # POST 卡片抽取
      cards/route.ts                    # GET 列表
      cards/[id]/route.ts               # GET 单卡 / PATCH 改卡
  lib/
    db.ts                     # Prisma 单例(globalThis 防热更新多实例)
    auth.ts                   # requireUser() + ensureProfile()（替代 authMiddleware）
    supabase/{client,server,middleware}.ts
    api-client.ts             # 前端 fetch 封装（迁自 client/services/api.ts）
  components/chat/…           # 简易对话组件
```

`packages/` 最终：`types` / `core` / `ai` / `config` 原样，`auth` 裁剪。`@supabase/ssr` 属 Next 专有，放 `apps/web/lib/supabase/`，**不**污染平台中立的 packages。

---

## 分阶段实施步骤

### 阶段 A — 脚手架
- 建 `apps/web/`。`package.json`：next 14.2 / react 18.3 / react-dom / @supabase/ssr / @supabase/supabase-js / @prisma/client / @say-clear/{types,core,ai,auth}(workspace:*)；dev：tailwindcss/postcss/autoprefixer/dotenv/@types/*/@say-clear/config。
- `next.config.ts`：`transpilePackages: ['@say-clear/types','@say-clear/core','@say-clear/ai','@say-clear/auth']`；顶部用 `dotenv` 加载根 `../../.env`（延续"根 .env 单一来源"）。
- `tsconfig.json`：extends `@say-clear/config/tsconfig.base.json`，加 `jsx:preserve`、`plugins:[{name:'next'}]`、`lib:[ES2022,DOM,DOM.Iterable]`、`types:['node']`、`paths:{'@/*':['./*']}`、`noEmit`。
- 关键文件：`apps/web/{next.config.ts,tsconfig.json,package.json}`

### 阶段 B — Prisma 单例 + 打通 source-only 包解析（地基，先验证）
- `lib/db.ts`：复用 `apps/server/src/db.ts`，改 `globalThis` 缓存单例。
- 首要验证：Next 能否 import 内部带 `.js` 后缀（实为 `.ts`）的 source-only 包（transpilePackages + Bundler 解析）。这是整个迁移的地基。
- 关键文件：`apps/web/lib/db.ts`

### 阶段 C — Supabase SSR 认证 + middleware（详见下）
- 关键文件：`lib/supabase/{client,server,middleware}.ts`、`middleware.ts`、`app/auth/callback/route.ts`、`lib/auth.ts`、`app/login/page.tsx`

### 阶段 D — API Route Handlers 迁移（10 个 route.ts）
逐一照搬 `apps/server/src/routes/*.ts` 的 handler 体，仅替换传输层：
- `c.get('user')` → `const { userId } = await requireUser()`
- `c.req.param('id')` → 第二参 `{ params }` 的 `params.id`
- `await c.req.json()` → `await req.json()`
- `c.json(x,201)` → `NextResponse.json(x,{status:201})`
- 每个 `route.ts` 加 `export const runtime='nodejs'`；流式路由再加 `export const dynamic='force-dynamic'`。
- 关键文件：`apps/web/app/api/**/route.ts`、`apps/web/lib/auth.ts`
- 复用源：[sessions.ts](file:///home/songxiaopeng/products/say-clear/apps/server/src/routes/sessions.ts)、[books.ts](file:///home/songxiaopeng/products/say-clear/apps/server/src/routes/books.ts)、[cards.ts](file:///home/songxiaopeng/products/say-clear/apps/server/src/routes/cards.ts)

### 阶段 E — 前端页面
- `lib/api-client.ts`：迁自 [api.ts](file:///home/songxiaopeng/products/say-clear/apps/client/src/services/api.ts)。`BASE_URL='/api'`（同源）；删 token 头与 `Taro.getStorageSync`（cookie 自动带）；`Taro.request`→`fetch`；`sendFeynmanMessage` 的 `fetch+ReadableStream` 读流原样保留。
- 页面 Taro 组件 → HTML + Tailwind：`login`/`shelf`/`book(new+[id])`/`feynman/[sessionId]`/`card`。`useRouter().params`→`useParams()`；`Taro.navigateTo`→`useRouter().push`；`showToast/showLoading`→简易 UI 反馈。
- 复用源：[feynman/index.tsx](file:///home/songxiaopeng/products/say-clear/apps/client/src/pages/feynman/index.tsx)（流式渲染状态机逻辑照搬）

### 阶段 F — 清理删除
- 删 `apps/client/`、`apps/server/` 整目录；删 `packages/auth/src/wechat.ts` 并更新 `index.ts`。
- `pnpm-workspace.yaml`：`onlyBuiltDependencies` 移除 `@tarojs/binding`/`@tarojs/cli`/`core-js`/`core-js-pure`；`nodeLinker:hoisted` **先保留**（稳妥，跑通后再评估）。
- `turbo.json`：`build.outputs` 去掉 `.taro/**`。

### 阶段 G — 环境变量 / 配置收尾
- `.env`/`.env.example`：`TARO_APP_SUPABASE_URL/ANON_KEY` → `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`；删 `TARO_APP_API_BASE`、`WECHAT_*`、`SERVER_PORT`。保留 `DATABASE_URL`、`AI_*`、`SUPABASE_URL`。`SUPABASE_SERVICE_ROLE_KEY` 变可选。
- `.gitignore`：加 `.next/`。

### 阶段 H — 验证（见末尾）

---

## @supabase/ssr 认证落地

- **browser client** `lib/supabase/client.ts`：`createBrowserClient(NEXT_PUBLIC_*)`，仅登录按钮用（内部自动 PKCE+cookie，替代原 `getSupabase()` 手动 PKCE）。
- **server client** `lib/supabase/server.ts`：`createServerClient(url, anon, { cookies:{getAll,setAll} })`，cookies 来自 `next/headers`。供 Route Handlers / Server Components / `lib/auth.ts`。
- **middleware** `lib/supabase/middleware.ts` + 根 `middleware.ts`：`updateSession` 调 `getUser()` 触发 token 刷新写回 cookie；根 middleware 做路由保护（未登录访问 `/shelf`/`/book`/`/feynman`/`/card` → 跳 `/login`），`matcher` 排除静态资源与 `/login`、`/auth/callback`。`/api/*` 不在此拦截，交各 handler 内 `requireUser()`。
- **/auth/callback** `app/auth/callback/route.ts`：`GET` 取 `code` → `exchangeCodeForSession(code)`（写 cookie）→ redirect `/shelf`。替代原 `app.tsx` 回调收尾 + `pages/callback`。
- **登录页** `app/login/page.tsx`：`signInWithOAuth({provider:'github', options:{redirectTo: location.origin+'/auth/callback'}})`。
- **requireUser()** `lib/auth.ts`：server client `getUser()` 校验（替代原 `createSupabaseServerAuth().verify(token)`）；无 user → 401；复用 `packages/auth` 的 `normalizeProvider` + displayName 兜底组装 `AuthUser`；`ensureProfile` 照搬 [auth.ts](file:///home/songxiaopeng/products/say-clear/apps/server/src/middleware/auth.ts) 的 `prisma.profile.upsert`。
- ⚠️ Supabase 控制台需把 `http://localhost:3000/auth/callback` 加入 Auth Redirect URLs 白名单。

---

## 流式追问（关键）

**后端** `app/api/sessions/[id]/messages/route.ts`：业务照搬 `sessions.ts` 的 messages handler（`requireUser`→查 session→`loadBookContext`→push user turn→`streamFeynmanReply`，复用 `@say-clear/ai`+`@say-clear/core`，`noThinking()` 不动）。传输层用手搓 `ReadableStream` 替代 `hono/streaming`，逐块 `controller.enqueue(encoder.encode(chunk))`，流结束后照搬 `turns.push` + `prisma.feynmanSession.update` 落库；`return new Response(rs, {headers:{'Content-Type':'text/plain; charset=utf-8'}})`。配 `runtime='nodejs'` + `dynamic='force-dynamic'`（防缓冲）。裸文本流契约与前端一致，**前端读流零改动**。

**前端** `feynman/[sessionId]/page.tsx`：沿用 `sendFeynmanMessage` 的 `getReader()`+`TextDecoder` 逐块 `onChunk`，React state 累加进最后一条 assistant 占位气泡逐字渲染（同原实现）。fetch 目标 `/api/sessions/${id}/messages`，去 token 头。

---

## Tailwind 接入
`postcss.config.mjs`（tailwindcss+autoprefixer）；`tailwind.config.ts`（content: app/components）；`globals.css`（@tailwind base/components/utilities）在 `layout.tsx` import。页面用 `className` 替代原 inline `rpx`/`.scss`。

---

## 依赖增删
- **apps/web 增**：next@14.2 / react@18.3 / react-dom / @supabase/ssr / @supabase/supabase-js / @prisma/client / @say-clear/{types,core,ai,auth}；dev：typescript/@types/{node,react,react-dom}/tailwindcss/postcss/autoprefixer/dotenv/@say-clear/config。
- **删**：随 client 删 `@tarojs/*`/`@babel/*`/`babel-preset-taro`/react-refresh 相关；随 server 删 `hono`/`@hono/node-server`/`tsx`；`packages/auth` 删 `@supabase/supabase-js`（若一并移除 `createSupabaseServerAuth`）。
- **留**：根 devDeps `@prisma/client`/`prisma`/`turbo`/`typescript`/`vitest`。lock 随 `pnpm install` 重算。

---

## 验证（端到端）
1. `pnpm install` 重算 lock；确认 prisma client 可用（**不重建库**）。
2. `pnpm -w typecheck` 全绿。
3. `pnpm --filter @say-clear/ai test`：vitest 单测绿（`calls.test.ts` 护栏——`thinking:disabled`+`mode:'json'` 未丢）。
4. `pnpm --filter web dev`（3000）走全链路：
   - `/` 未登录→`/login`→GitHub→`/auth/callback`→`/shelf`。
   - `/book/new` 填书名+划线→`POST /api/books`+`/highlights`+`/sessions`→`/feynman/[id]` 显首问。
   - 回答→`POST /api/sessions/:id/messages` **流式逐字**出追问；刷新→`GET /api/sessions/:id` 读回历史。
   - "我讲完了"→`finish`（验证 ~5s 而非 ~39s，证明 `noThinking()` 生效）→`card`→`/card` 列出。
   - `PATCH /api/cards/:id` 改卡、`GET /api/cards` 列表。
5. 未登录直打 `/api/books` → 401（`requireUser` 生效）。
6. `pnpm --filter web build` + `next start` 生产构建通过。

---

## 风险与注意事项
1. **source-only 包 + `.js` 后缀解析**（最高优先，阶段 B 先打通）：transpilePackages + Bundler 通常可解析，否则确认解析模式与 transpile 覆盖。
2. **API 路由必须 Node runtime**：Prisma/AI 不能跑 Edge，每个 `route.ts` 显式 `runtime='nodejs'`。
3. **Prisma 单例**：dev 热更新重复 new，`lib/db.ts` 用 `globalThis` 缓存。
4. **豆包提速修复不可丢**：`packages/ai` 的 `noThinking()`+`mode:'json'` 原样保留，`calls.test.ts` 是护栏。
5. **流式不被缓冲**：Node runtime + `dynamic='force-dynamic'`。
6. **pnpm nodeLinker**：先保留 hoisted，跑通后再评估切 isolated。
7. **Next 版本**：本方案锁 Next 14.2 + React 18（`cookies()` 同步）。若上 Next 15 需改异步写法。
8. **Supabase Redirect URL**：新增 `localhost:3000/auth/callback` 白名单。
9. **环境变量单一来源**：`NEXT_PUBLIC_*` 编译期内联；勿给非 anon 密钥加 `NEXT_PUBLIC_` 前缀。
10. **cookie 同源鉴权**：前端 `fetch('/api/...')` 自动带 cookie，务必删旧 Bearer 头。
11. **`getUser()` 每请求校验**：增一次网络往返，MVP 可接受。
12. **RLS 不变**：Prisma 以 postgres 角色绕过 RLS，纵深防御照旧。
