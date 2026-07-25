# SayClear · 技术方案文档

> 配套文档：[产品技术规划文档](./reading-coach-product-plan.md)  
> 文档版本：v2.0 ｜ 状态：Next.js 全栈重构定稿  
> 本文档只承载技术选型与架构决策；费曼 prompt 链单列为最高优先级独立 spec，见 [reading-coach-feynman-prompt-spec.md](./reading-coach-feynman-prompt-spec.md)。

---

## 0. TL;DR

| 层 | 定稿 | 说明 |
|---|---|---|
| Monorepo | pnpm workspace + Turborepo | 保留 workspace/packages 分层 |
| Web App | Next.js 14 App Router + React 18 | 主战场转向 Web/PC，页面与 API 收敛到单应用 |
| API | Next Route Handlers | 代替独立 Hono 服务，同源 cookie 鉴权，无 CORS 问题 |
| 样式 | Tailwind CSS | 先做极简可用页面，后续 PC UI 可快速重设计 |
| Auth | Supabase Auth + @supabase/ssr cookie | GitHub V1；服务端会话、middleware 刷新与路由保护 |
| DB | Supabase PostgreSQL + Prisma | 复用既有 schema 与 RLS，Prisma 后端访问 |
| AI | Vercel AI SDK + OpenAI-compatible Doubao | 通过 packages/ai 的 getModel(task) 收口，业务不写死模型名 |

核心哲学不变：**能力收口，业务无感**。模型、认证、数据访问和费曼 prompt 链都沉到 packages 或 app/lib，页面只编排产品流程。

---

## 1. 目标范围

V1 只交付 P0 闭环：**登录 → 书架 → 贴划线 → 费曼闯关 → 清晰度报告 → 观点卡片**。

本次重构的目标是把 Web 端做好：先得到一个能跑通闭环的 Next.js Web 应用。微信小程序未来单独新建 Taro 应用，不再强行让 Web 受小程序组件子集约束。

---

## 2. 仓库拓扑

```
say-clear/
├─ apps/
│  └─ web/                 # Next.js 全栈 Web 应用
├─ packages/
│  ├─ types/               # 领域类型 + API DTO + Zod schema
│  ├─ core/                # 端无关费曼 prompt / 状态机
│  ├─ ai/                  # 模型抽象层：getModel(task) + 三类 AI 调用
│  ├─ auth/                # 认证领域契约 + provider 归一化
│  └─ config/              # tsconfig 预设
├─ prisma/                 # schema.prisma + RLS SQL
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

依赖方向：`apps/web → packages/*`；packages 之间保持轻量、端无关。Next 专属能力（@supabase/ssr、middleware、Route Handlers）只放在 `apps/web`。

---

## 3. apps/web 结构

```
apps/web/
├─ app/
│  ├─ login/page.tsx
│  ├─ auth/callback/route.ts
│  ├─ shelf/page.tsx
│  ├─ book/new/page.tsx
│  ├─ book/[id]/page.tsx
│  ├─ feynman/[sessionId]/page.tsx
│  ├─ card/page.tsx
│  └─ api/**/route.ts
├─ lib/
│  ├─ api-client.ts        # 前端同源 fetch + 流式读取
│  ├─ auth.ts              # requireUser + ensureProfile
│  ├─ book-context.ts
│  ├─ db.ts                # Prisma globalThis 单例
│  └─ supabase/            # browser/server/middleware client
├─ middleware.ts
├─ next.config.mjs
└─ tailwind.config.ts
```

所有 API Route Handler 显式使用 `runtime = 'nodejs'`，需要 cookie 鉴权的路由显式 `dynamic = 'force-dynamic'`，避免静态探测和 Edge runtime 误用。

---

## 4. 认证方案

- 浏览器登录：`createBrowserClient` 发起 GitHub OAuth，回调地址为 `/auth/callback`。
- 回调收尾：Route Handler 中 `exchangeCodeForSession(code)`，会话写入 cookie。
- 路由保护：middleware 刷新会话；未登录访问 `/shelf`、`/book`、`/feynman`、`/card` 重定向到 `/login`。
- API 鉴权：每个 Route Handler 调 `requireUser()`，内部用 Supabase server client `auth.getUser()` 校验 cookie 会话，并自动 `profile.upsert`。

Supabase 控制台必须配置 Redirect URL：`http://localhost:3000/auth/callback`（以及未来线上域名）。

---

## 5. API 设计

所有接口位于同源 `/api`，不需要 CORS。

| Method | Path | 说明 |
|---|---|---|
| GET | /api/books | 我的书架 |
| POST | /api/books | 新建书 |
| GET | /api/books/:id | 书详情（含划线/卡片） |
| POST | /api/books/:id/highlights | 贴划线 |
| POST | /api/books/:id/sessions | 开启费曼会话并生成首问 |
| GET | /api/sessions/:id | 会话详情（turns + report） |
| POST | /api/sessions/:id/messages | 流式返回笨学生追问 |
| POST | /api/sessions/:id/finish | 生成清晰度报告 |
| POST | /api/sessions/:id/card | 生成观点卡片 |
| GET | /api/cards | 卡片列表 |
| GET/PATCH | /api/cards/:id | 查看/编辑单张卡片 |

请求 DTO 与结构化输出继续复用 `packages/types` 的 Zod schema。

---

## 6. AI 方案

业务代码只调用 `packages/ai`：

- `streamFeynmanReply`：笨学生流式追问。
- `generateClarityReport`：清晰度报告。
- `extractCardDraft`：观点卡片草稿。

模型通过 `getModel(task)` 获取，具体 provider/model id 只来自 env。豆包 seed 推理模型默认会输出大量 `reasoning_content`，已在 `packages/ai/src/calls.ts` 通过 `providerOptions: { thinking: { type: 'disabled' } }` 关闭深度推理，并用测试锁住，避免 finish 接口重新退回 30-40 秒 Pending。

---

## 7. 数据模型

继续使用 `prisma/schema.prisma`：

- Profile
- Identity
- Book
- Highlight
- FeynmanSession
- OpinionCard

RLS SQL 继续保留。Prisma 后端以数据库连接访问，RLS 作为 Supabase 直连/PostgREST 场景的纵深防御。

---

## 8. 环境变量

服务端：

- `DATABASE_URL`
- `SUPABASE_URL`
- `AI_PROVIDER`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL_FEYNMAN`
- `AI_MODEL_REPORT`

客户端可公开：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

旧的 `TARO_APP_*`、`SERVER_PORT`、`WECHAT_*` 在本阶段移除。

---

## 9. 验证要求

1. `pnpm --filter @say-clear/ai test`：模型调用护栏测试通过。
2. `pnpm -w typecheck`：全仓类型检查通过。
3. `pnpm --filter web build`：Next 生产构建通过。
4. 运行态 smoke test：`/login` 返回 200，未登录 `/api/books` 返回 401。
5. 浏览器端到端：GitHub 登录后走完书架、加书、贴划线、费曼流式追问、报告与卡片。
