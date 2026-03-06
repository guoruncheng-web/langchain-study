# AI 客服聊天应用

基于 Next.js 16 + LangChain + 阿里云百炼平台（Qwen）的 AI 客服聊天应用，集成 Neon PostgreSQL 云数据库，支持 RAG 知识库检索。

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

访问 http://localhost:3000

## 环境变量

在 `.env.local` 中配置：

```bash
OPENAI_API_KEY=xxx                  # 阿里云百炼平台 API Key
DATABASE_URL=postgresql://...       # Neon PostgreSQL 连接字符串
JWT_SECRET=xxx                      # JWT 签名密钥
# DASHSCOPE_MODEL=qwen-plus        # 可选，默认 qwen-plus
```

## 技术栈

- **框架**: Next.js 16 + TypeScript
- **AI**: LangChain + 阿里云百炼平台 DashScope（Qwen 模型）
- **数据库**: Neon Serverless PostgreSQL + pgvector
- **认证**: JWT + HttpOnly Cookie
- **样式**: Tailwind CSS 4 + 科幻暗色主题
- **部署**: Vercel（推送 GitHub 自动部署）

---

## 已完成功能

### 用户系统
- [x] 用户注册（用户名 + 邮箱 + 密码）
- [x] 用户登录（支持用户名或邮箱登录）
- [x] JWT + HttpOnly Cookie 认证
- [x] 路由权限保护（middleware 拦截）
- [x] 角色权限（admin / user）
- [x] 账户状态管理（启用 / 禁用）

### AI 聊天
- [x] 基于 Qwen 模型的流式聊天响应
- [x] 聊天消息持久化（PostgreSQL）
- [x] 会话管理（新建、切换、历史列表）
- [x] 会话删除与重命名（侧边栏操作按钮 + 确认弹窗）
- [x] Markdown 渲染与代码高亮（react-markdown + rehype-highlight）
- [x] 消息复制功能（一键复制 AI 回复）
- [x] 消息中链接自动高亮（可点击跳转）
- [x] Token 每日额度限制（非 admin 用户，按天自动重置）
- [x] Token 用量按实际消耗计量（API 返回 + 字符数兜底估算）

### RAG 知识库
- [x] 文档上传（支持 .txt / .md 格式，拖拽上传）
- [x] 向量化存储（DashScope text-embedding-v3 + pgvector HNSW 索引）
- [x] 聊天时自动检索知识库相关内容作为上下文
- [x] 文档管理（列表、状态查看、删除）

### 管理后台
- [x] 用户管理（列表、搜索、新增用户）
- [x] 角色修改与状态切换
- [x] Token 额度管理（查看/修改额度、重置已用量）
- [x] 知识库文档管理（查看所有文档及上传者）
- [x] 数据统计仪表盘（用户增长、每日消息量、Token 消耗趋势图）

### UI/UX
- [x] 科幻暗色主题（粒子背景、扫描线、霓虹发光、脉冲动画）
- [x] 暗色/亮色模式（跟随系统偏好）
- [x] 响应式设计（移动端侧边栏折叠）
- [x] 操作 Loading 状态（删除、重命名等）
- [x] 科幻风格弹窗（删除确认、额度用尽提示）

---

## 待完成功能

### 中优先级
- [ ] **对话导出** - 将聊天会话导出为 Markdown / TXT 文件
- [ ] **多模型切换** - 用户可选择 qwen-turbo / qwen-plus / qwen-max
- [ ] **系统提示词模板** - 管理员预设角色模板（客服/代码/翻译助手）
- [ ] **消息搜索** - 全文搜索历史聊天记录

### 低优先级
- [ ] **错误重试机制** - AI 回复失败时显示"重试"按钮
- [ ] **知识库支持更多格式** - 支持 PDF、DOCX、CSV 上传
- [ ] **暗色/亮色手动切换** - 用户手动选择主题，不仅跟随系统
- [ ] **用户个人设置页面** - 查看账户信息、修改密码、Token 用量

---

## 项目结构

```
app/
├── page.tsx                          # 首页
├── layout.tsx                        # 根布局
├── globals.css                       # 全局样式（Tailwind CSS 4 + 科幻主题）
├── contexts/AuthContext.tsx           # 认证上下文
├── login/page.tsx                    # 登录页
├── register/page.tsx                 # 注册页
├── chat/page.tsx                     # 聊天页（含侧边栏、会话管理）
├── kb/page.tsx                       # 知识库管理页
├── admin/
│   ├── layout.tsx                    # 管理后台布局（导航）
│   ├── page.tsx                      # 用户管理页
│   └── stats/page.tsx                # 数据统计仪表盘
└── api/
    ├── auth/                         # 认证 API（注册/登录/登出/当前用户）
    ├── chat/                         # 聊天 API（流式响应/历史/会话管理）
    ├── admin/                        # 管理 API（用户管理/统计）
    └── kb/                           # 知识库 API（上传/列表/删除）

lib/
├── db.ts                             # 数据库连接与表初始化
├── auth.ts                           # JWT 工具
├── rag.ts                            # RAG 向量存储
└── validations.ts                    # 输入校验

middleware.ts                         # 路由权限控制
```

## 部署

项目通过 Vercel 部署，推送代码到 GitHub 仓库时自动触发构建部署。

```bash
# 本地预览生产构建
vercel build
vercel dev
```
