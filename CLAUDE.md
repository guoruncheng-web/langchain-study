# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。
你回答的时候用中文

## 项目概述

这是一个集成了 LangChain 的 Next.js 16 应用，用于实现 AI 客服聊天功能。使用阿里云百炼平台（DashScope）的 Qwen 模型进行流式聊天响应，集成 Neon PostgreSQL 云数据库实现用户认证和聊天记录持久化。
项目可以采用 vercel 部署，当本地推送代码到 github 仓库的时候，触发 vercel 构建自动完成项目的部署。
本地已经安装了 vercel cli 和 gh 工具，可以在本地使用 vercel cli 管理线上的项目和使用 gh 完成 github 的所有配置。

## 开发命令

- **启动开发服务器**: `pnpm dev`
  - 运行在 http://localhost:3000
  - 首页在 `/`，聊天界面在 `/chat`，登录在 `/login`，注册在 `/register`

- **构建**: `pnpm build`
  - 在 `.next/` 目录生成生产构建

- **启动生产服务器**: `pnpm start`

- **代码检查**: `pnpm lint`
  - 使用 Next.js 配置运行 ESLint（`.claude/` 目录已被忽略）

## 架构

### 目录结构

```
app/
├── page.tsx                          # 首页
├── layout.tsx                        # 根布局（包裹 AuthProvider）
├── globals.css                       # 全局样式 (Tailwind CSS 4)
├── contexts/
│   └── AuthContext.tsx                # 认证上下文（用户状态、登录、注册、登出）
├── login/
│   └── page.tsx                      # 登录页面
├── register/
│   └── page.tsx                      # 注册页面
├── chat/
│   └── page.tsx                      # 聊天页面（含侧边栏、会话管理）
└── api/
    ├── auth/
    │   ├── register/route.ts         # POST 用户注册
    │   ├── login/route.ts            # POST 用户登录
    │   ├── logout/route.ts           # POST 用户登出
    │   └── me/route.ts               # GET 当前用户信息
    └── chat/
        ├── route.ts                  # POST 聊天（流式响应+消息持久化）
        └── history/
            ├── route.ts              # GET 聊天会话列表
            └── [sessionId]/route.ts  # GET 指定会话消息

lib/
├── db.ts                             # Neon PostgreSQL 数据库连接与表初始化
├── auth.ts                           # JWT 工具（签发、验证、Cookie 管理）
└── validations.ts                    # 输入校验（用户名、邮箱、密码）

middleware.ts                         # 路由权限控制
docs/
└── requirements-login-auth.md        # 登录权限需求文档
```

### 认证系统

- **JWT + HttpOnly Cookie**：用户登录后签发 JWT Token，存储在 HttpOnly Cookie 中（防 XSS）
- **路由保护**：`middleware.ts` 拦截受保护路由，未登录重定向到 `/login`
- **AuthContext**：前端通过 React Context 全局管理用户状态，提供 `useAuth()` Hook
- **密码加密**：使用 bcryptjs（salt rounds = 10）加密存储

### 数据库（Neon PostgreSQL）

使用 Neon Serverless PostgreSQL，通过 `@neondatabase/serverless` 连接：

**表结构**：

- `users` - 用户表（id UUID PK, username, email, password_hash, created_at, updated_at）
- `chat_sessions` - 聊天会话表（id UUID PK, user_id FK→users, title, created_at, updated_at）
- `messages` - 消息表（id UUID PK, session_id FK→chat_sessions, role, content, created_at）

**外键关系**：

- `chat_sessions.user_id` → `users.id`（ON DELETE CASCADE）
- `messages.session_id` → `chat_sessions.id`（ON DELETE CASCADE）

**索引**：

- `idx_sessions_user_id` - 加速按用户查询会话
- `idx_messages_session_id` - 加速按会话查询消息

所有 SQL 查询使用 Neon 的模板字符串（参数化查询）防止注入。

### LangChain 集成

聊天 API（`app/api/chat/route.ts`）：

1. **模型**：阿里云百炼平台 DashScope（Qwen 模型），通过 `ChatOpenAI` 兼容模式调用
2. **流式传输**：`streaming: true` + `ReadableStream` 实现流式响应
3. **消息持久化**：用户消息和 AI 回复自动保存到 PostgreSQL
4. **会话管理**：首次发送自动创建 ChatSession，后续消息关联到同一会话

### 前端聊天页面

聊天 UI（`app/chat/page.tsx`）功能：

- 顶部导航栏（标题 + 用户名 + 退出按钮）
- 左侧会话侧边栏（可折叠，新建对话，历史会话列表，当前会话高亮）
- 流式消息显示和自动滚动
- 响应式设计（移动端侧边栏收起，点击汉堡菜单展开）

### 样式

- Tailwind CSS 4 + PostCSS
- Geist / Geist Mono 字体（Google Fonts）
- 暗色模式支持（CSS `prefers-color-scheme` + `dark:` 前缀）
- 响应式设计

## 环境变量

在 `.env.local` 中配置（不纳入 git）：

```bash
# AI 模型（阿里云百炼平台）
OPENAI_API_KEY=xxx                     # ChatOpenAI 默认读取此变量
# DASHSCOPE_MODEL=qwen-plus            # 可选，默认 qwen-plus

# Neon PostgreSQL 数据库
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# JWT 密钥
JWT_SECRET=xxx
```

## 关键技术细节

- TypeScript 严格模式，目标 ES2017
- 路径别名 `@/*` 映射到根目录
- ESLint 使用 Next.js core-web-vitals + TypeScript 配置
- 依赖管理使用 pnpm
- 主要依赖：@neondatabase/serverless、bcryptjs、jsonwebtoken、uuid、@langchain/\*

## API 概览

| 方法 | 路径                          | 描述                 | 认证 |
| ---- | ----------------------------- | -------------------- | ---- |
| POST | /api/auth/register            | 用户注册             | 否   |
| POST | /api/auth/login               | 用户登录             | 否   |
| POST | /api/auth/logout              | 用户登出             | 否   |
| GET  | /api/auth/me                  | 获取当前用户         | 是   |
| POST | /api/chat                     | 发送聊天消息（流式） | 是   |
| GET  | /api/chat/history             | 获取会话列表         | 是   |
| GET  | /api/chat/history/[sessionId] | 获取会话消息         | 是   |
