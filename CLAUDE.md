# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 项目概述

这是一个集成了 LangChain 的 Next.js 16 应用，用于实现 AI 客服 聊天功能。项目演示了如何使用 OpenAI 的 GPT 模型或智谱 AI 的 GLM 模型进行流式聊天响应。
项目可以采用vercel部署,当本地推送代码到github仓库的时候,触发vercel构建自动完成项目的部署
本地已经安装了vercel cli 和 gh工具, 可以在本地使用vercel cli管理线上的项目和使用gh完成github的所有配置

## 开发命令

- **启动开发服务器**: `npm run dev`（或 `pnpm dev`）
  - 运行在 http://localhost:3000
  - 首页在 `/`，聊天界面在 `/chat`

- **构建**: `npm run build`
  - 在 `.next/` 目录生成生产构建

- **启动生产服务器**: `npm start`
  - 提供生产构建的服务

- **代码检查**: `npm run lint`
  - 使用 Next.js 配置运行 ESLint

## 架构

### 核心结构

本项目使用 Next.js App Router（非 Pages Router）。所有路由位于 `app/` 目录：

- `app/page.tsx` - 首页
- `app/chat/page.tsx` - 聊天 UI 组件（客户端）
- `app/api/chat/route.ts` - 支持流式传输的聊天 API 端点
- `app/layout.tsx` - 根布局，加载 Geist 字体

### LangChain 集成

聊天 API（`app/api/chat/route.ts`）实现了：

1. **模型选择**: 环境变量 `USE_GLM` 决定使用哪个 AI 模型：
   - 若 `USE_GLM=true`：使用智谱 AI 的 GLM-4 模型，基础 URL 为 `https://open.bigmodel.cn/api/paas/v4`
   - 否则：使用 OpenAI 的 GPT-3.5-turbo

2. **API 密钥**: 在 `.env.local` 中配置：
   - `OPENAI_API_KEY` 用于 OpenAI 模型
   - `GLM_API_KEY` 用于智谱 AI 模型
   - `USE_GLM=true` 启用 GLM 模型

3. **流式传输**: API 使用 LangChain 的流式能力：
   - `ChatOpenAI` 以 `streaming: true` 初始化
   - 消息转换为 LangChain 消息类型（HumanMessage、AIMessage、SystemMessage）
   - 响应以 `ReadableStream` 流式返回客户端

4. **消息格式**: 聊天通过每次请求发送所有历史消息来维护对话上下文

### 前端聊天实现

聊天 UI（`app/chat/page.tsx`）是一个客户端组件，功能包括：

- 管理消息状态并显示对话历史
- 向 `/api/chat` 发送 POST 请求，携带完整消息历史
- 使用 `ReadableStream` API 接收流式响应
- 随着 token 到达逐步更新 UI
- 包含加载状态和自动滚动行为

### 样式

- 使用 Tailwind CSS 4 + PostCSS
- 通过 `next/font/google` 加载 Geist 和 Geist Mono 字体
- 基础模板支持暗色模式

## 关键技术细节

- TypeScript 配置为严格模式，目标为 ES2017
- 路径别名 `@/*` 映射到根目录
- ESLint 使用 Next.js core-web-vitals 和 TypeScript 配置
- 环境变量从 `.env.local` 加载（不纳入 git 版本控制）
- Next.js 无额外自定义配置
