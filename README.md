# SayClear

SayClear 是一个基于费曼技巧的阅读输出陪练工具。

它不替用户总结书、不提供标准答案，而是让 AI 扮演一个“没读过这本书、但真诚好奇的笨学生”，通过追问逼用户把自己读过的内容讲清楚。通关后沉淀的是用户自己的观点卡片，不是 AI 代写的读书笔记。

> 读完不算数，说清才算懂。

## 核心原则

- **只评表达清晰度**：AI 不判断书本知识对错，只判断用户有没有讲清楚。
- **不代写观点**：观点卡片必须来自用户在对话中真实说过的话。
- **划线是局部上下文**：用户贴上的划线只用于追问和对照，不作为标准答案直接灌给用户。
- **安全隔离**：所有业务数据都绑定 `userId`，接口查询必须校验当前登录用户。

## 功能闭环

当前 PC Web MVP 已覆盖完整阅读输出链路：

1. 在首页进入产品。
2. 登录后进入书架。
3. 创建一本书并粘贴划线。
4. 发起费曼闯关会话。
5. AI 以流式对话追问用户。
6. 生成清晰度体检报告。
7. 基于用户原话沉淀观点卡片。

主要页面：

- `/`：产品首页
- `/login`：登录页
- `/shelf`：我的书架
- `/book/new`：创建书籍
- `/book/[id]`：书籍详情与划线管理
- `/feynman/[sessionId]`：费曼闯关
- `/card`：观点卡片库

## 技术栈

- **框架**：Next.js 14 App Router
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **认证**：Supabase Auth
- **数据库**：Supabase Postgres + Prisma
- **AI**：Vercel AI SDK + OpenAI Compatible Provider
- **单仓库**：pnpm workspace + Turborepo

## 目录结构

```txt
.
├── apps/
│   └── web/                  # Next.js Web 应用
│       ├── app/              # 页面与 API Route Handlers
│       ├── components/       # Web 组件
│       └── lib/              # API client、Supabase、Prisma、鉴权工具
├── packages/
│   ├── ai/                   # AI SDK 调用封装
│   ├── auth/                 # 认证领域类型与 provider 归一化
│   ├── config/               # 共享 TypeScript 配置
│   ├── core/                 # 费曼状态机与 Prompt 模板
│   └── types/                # 领域类型、DTO、Zod schema
├── prisma/
│   ├── schema.prisma         # Prisma 数据模型
│   └── rls.sql               # Supabase RLS 策略
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

项目要求：

- Node.js `>=20`
- pnpm `11.13.1`

### 2. 配置环境变量

```bash
cp .env.example .env
```

需要填写：

```bash
# Supabase
SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Prisma / Postgres
DATABASE_URL=

# AI Provider
AI_PROVIDER=doubao
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_API_KEY=
AI_MODEL_FEYNMAN=
AI_MODEL_REPORT=
```

说明：

- `DATABASE_URL` 推荐使用 Supabase Session Pooler URI，某些本地网络对 Supabase Direct Connection 的 IPv6 解析不稳定。
- `AI_BASE_URL` 使用 OpenAI 兼容端点；当前默认面向 Doubao / 火山方舟。
- `AI_MODEL_REPORT` 可省略，省略时复用 `AI_MODEL_FEYNMAN`。

### 3. 初始化数据库

```bash
pnpm exec prisma generate
pnpm exec prisma db push
```

如果使用 Supabase，请在 SQL Editor 中执行 `prisma/rls.sql`，开启应用表的 RLS 策略。

### 4. 启动开发服务

```bash
pnpm dev
```

Web 应用默认运行在：

```txt
http://localhost:3000
```

`apps/web` 的脚本使用独立构建目录：

- `dev`：`NEXT_DIST_DIR=.next-dev`
- `build`：`NEXT_DIST_DIR=.next-build`

这样可以减少 `next dev` 和 `next build` 同时运行时的缓存产物冲突。

## 常用命令

```bash
pnpm dev          # 启动所有开发服务
pnpm build        # 构建所有 workspace
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # 运行 lint（当前依赖各 workspace 配置）
```

AI 包测试：

```bash
pnpm --filter @say-clear/ai test
```

## API 概览

前端统一通过 `apps/web/lib/api-client.ts` 调用后端接口，不直接访问 Supabase 数据。

| Method | Endpoint | 说明 |
| --- | --- | --- |
| `GET` | `/api/books` | 获取当前用户书籍列表 |
| `POST` | `/api/books` | 创建书籍 |
| `GET` | `/api/books/[id]` | 获取书籍详情、划线、观点卡片 |
| `DELETE` | `/api/books/[id]` | 删除书籍及关联数据 |
| `POST` | `/api/books/[id]/highlights` | 新增划线 |
| `POST` | `/api/books/[id]/sessions` | 开启费曼闯关 |
| `GET` | `/api/sessions/[id]` | 获取闯关会话 |
| `POST` | `/api/sessions/[id]/messages` | 提交流式追问消息 |
| `POST` | `/api/sessions/[id]/finish` | 生成清晰度报告 |
| `POST` | `/api/sessions/[id]/card` | 生成观点卡片 |
| `GET` | `/api/cards` | 获取观点卡片列表 |
| `GET` | `/api/cards/[id]` | 获取单张观点卡片 |
| `PATCH` | `/api/cards/[id]` | 更新观点卡片 |

## 数据模型

核心模型位于 `prisma/schema.prisma`：

- `Profile`：应用侧用户档案，镜像 Supabase `auth.users`
- `Identity`：多登录来源身份映射
- `Book`：用户书籍
- `Highlight`：用户划线原文
- `FeynmanSession`：费曼闯关会话，保存多轮对话与清晰度报告
- `OpinionCard`：用户观点卡片

`Book` 与 `Highlight`、`FeynmanSession`、`OpinionCard` 存在级联删除关系。

## AI 工作流

AI 逻辑拆成三层：

- `@say-clear/core`：构造首问、追问 Prompt、报告 Prompt、卡片抽取 Prompt，以及费曼状态机。
- `@say-clear/ai`：负责按任务调用模型，统一关闭不必要的推理输出，减少结构化任务延迟。
- `apps/web/app/api/*`：负责鉴权、读写数据库、调用 core/ai，并向前端返回 JSON 或流式文本。

费曼流程：

1. `buildFirstQuestion` 生成固定首问。
2. `streamFeynmanReply` 以“笨学生”角色流式追问。
3. `generateClarityReport` 生成清晰度报告。
4. `extractCardDraft` 只从用户原话中抽取观点卡片。

## 工程约定

- 前端访问后端必须经过 `apps/web/lib/api-client.ts`。
- API Route Handler 必须调用 `requireUser()`，并在 Prisma 查询中使用 `userId` 做隔离。
- 共享 DTO 和校验规则放在 `@say-clear/types`，避免前后端重复定义。
- 费曼相关纯逻辑放在 `@say-clear/core`，避免绑定 Next.js 或数据库。
- 模型调用只通过 `@say-clear/ai`，业务代码不直接写具体模型名。
- 全局导航统一复用 `apps/web/components/AppHeader.tsx`。

## 部署说明

### 推荐方式

早期最省心的部署组合：

- Web：Vercel
- Auth / DB：Supabase
- AI：支持 OpenAI Compatible API 的模型服务

如果要部署到自己的服务器，推荐使用 Docker 镜像。项目已配置 Next.js standalone 输出，镜像只包含运行时需要的文件，不会把本地 `.env` 打进镜像。

### Docker 镜像

1. 准备生产环境变量：

```bash
cp .env.production.example .env.production
```

填写 `.env.production`：

```bash
SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
AI_PROVIDER=doubao
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_API_KEY=
AI_MODEL_FEYNMAN=
AI_MODEL_REPORT=
```

`DATABASE_URL` 推荐使用 Supabase Session Pooler URI。

2. 本地构建镜像：

```bash
export NEXT_PUBLIC_SUPABASE_URL="你的 Supabase URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="你的 Supabase anon key"

docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t say-clear-web:latest .
```

`NEXT_PUBLIC_*` 是浏览器侧变量，Next.js 会在构建时写入前端 bundle，所以构建镜像时必须传入。`DATABASE_URL`、`AI_API_KEY` 等服务端密钥仍然只通过运行时环境变量注入。

3. 本地运行镜像：

```bash
docker run --rm \
  --env-file .env.production \
  -p 3000:3000 \
  say-clear-web:latest
```

4. 使用 Docker Compose：

```bash
docker compose --env-file .env.production up -d --build
```

5. 服务器部署：

```bash
docker save say-clear-web:latest | gzip > say-clear-web.tar.gz
scp say-clear-web.tar.gz user@server:/opt/say-clear/

ssh user@server
cd /opt/say-clear
gunzip -c say-clear-web.tar.gz | docker load
docker run -d \
  --name say-clear-web \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  say-clear-web:latest
```

生产环境通常再在容器前面放一层 Nginx/Caddy，负责 HTTPS 和域名转发。

### 部署前检查

部署前确认：

1. Vercel 环境变量与 `.env.example` 对齐。
2. Supabase Auth 回调地址包含 `/auth/callback`。
3. Prisma schema 已同步到目标数据库。
4. Supabase RLS 策略已执行。
5. 生产环境的 AI key 仅通过环境变量注入。

## 已知注意事项

- 本地如果遇到 `node_modules/.bin/turbo` 权限问题，可执行：

```bash
chmod +x node_modules/.bin/turbo
```

- 如果 Next.js 报 `Cannot find module './vendor-chunks/@opentelemetry.js'`，通常是开发服务和构建任务同时写入缓存导致。停止服务后清理对应 `.next*` 目录，再重新启动即可。
- Supabase Direct Connection 在部分网络下可能连接失败，优先改用 Session Pooler。
