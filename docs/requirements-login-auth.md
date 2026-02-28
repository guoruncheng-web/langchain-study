# 登录权限与 Neo4j 数据库需求文档

> 版本: 1.0
> 日期: 2026-02-28
> 项目: AI 客服聊天系统 (Next.js 16 + LangChain)

---

## 目录

1. [功能描述](#1-功能描述)
2. [数据库设计（Neo4j）](#2-数据库设计neo4j)
3. [API 设计](#3-api-设计)
4. [前端页面设计](#4-前端页面设计)
5. [涉及文件清单](#5-涉及文件清单)
6. [技术选型](#6-技术选型)
7. [验收标准](#7-验收标准)

---

## 1. 功能描述

### 1.1 用户注册

- 用户填写用户名、密码、邮箱完成注册
- 用户名唯一性校验（不区分大小写）
- 邮箱格式校验 + 唯一性校验
- 密码强度要求：至少 8 位，包含字母和数字
- 密码使用 bcryptjs 加密后存储，原文不落库
- 注册成功后自动登录，返回 JWT Token

### 1.2 用户登录

- 支持「用户名」或「邮箱」+ 密码登录
- 登录成功返回 JWT Token（有效期 7 天）
- JWT Token 存储在 HttpOnly Cookie 中，防止 XSS 攻击
- 登录失败返回统一错误信息（不区分「用户不存在」和「密码错误」，防止枚举攻击）

### 1.3 JWT Token 认证

- Token 包含用户 ID、用户名，签发时间、过期时间
- 服务端使用 `JWT_SECRET` 环境变量签名
- API 请求通过 Cookie 中的 Token 自动携带身份信息
- Token 过期后需重新登录

### 1.4 登录状态管理

- 前端通过调用 `/api/auth/me` 判断登录状态
- 使用 React Context 全局管理用户状态
- 提供登出功能：清除 Cookie 中的 Token

### 1.5 路由权限控制

- 使用 Next.js Middleware 实现路由保护
- 受保护路由：`/chat`、`/chat/*`、`/api/chat`、`/api/chat/*`
- 公开路由：`/`、`/login`、`/register`、`/api/auth/*`
- 未登录用户访问受保护路由时，重定向到 `/login`
- 已登录用户访问 `/login` 或 `/register` 时，重定向到 `/chat`

### 1.6 聊天记录持久化

- 每个用户可以创建多个聊天会话（ChatSession）
- 每条消息（Message）关联到具体的聊天会话
- 消息记录包含角色（user/assistant）、内容、时间戳
- 用户可以查看历史聊天会话列表
- 用户可以切换到历史会话继续对话
- 新对话自动创建新的 ChatSession

---

## 2. 数据库设计（Neo4j）

### 2.1 节点设计

#### User 节点

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 用户唯一标识 |
| `username` | String | 用户名（唯一，存储为小写） |
| `email` | String | 邮箱地址（唯一，存储为小写） |
| `passwordHash` | String | bcrypt 加密后的密码哈希 |
| `createdAt` | DateTime | 注册时间 |
| `updatedAt` | DateTime | 最后更新时间 |

约束：
```cypher
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT user_username_unique IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE;
CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE;
```

#### ChatSession 节点

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 会话唯一标识 |
| `title` | String | 会话标题（取首条用户消息的前 30 个字符） |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 最后活跃时间 |

约束：
```cypher
CREATE CONSTRAINT session_id_unique IF NOT EXISTS FOR (s:ChatSession) REQUIRE s.id IS UNIQUE;
```

#### Message 节点

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 消息唯一标识 |
| `role` | String | 消息角色：`user` 或 `assistant` |
| `content` | String | 消息内容 |
| `createdAt` | DateTime | 发送时间 |

约束：
```cypher
CREATE CONSTRAINT message_id_unique IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE;
```

### 2.2 关系设计

```
(User)-[:HAS_SESSION]->(ChatSession)
(ChatSession)-[:HAS_MESSAGE]->(Message)
(Message)-[:NEXT]->(Message)
```

| 关系 | 起始节点 | 目标节点 | 说明 |
|------|----------|----------|------|
| `HAS_SESSION` | User | ChatSession | 用户拥有的聊天会话 |
| `HAS_MESSAGE` | ChatSession | Message | 会话包含的消息 |
| `NEXT` | Message | Message | 消息的先后顺序（链表结构） |

关系图示：
```
(User)--[:HAS_SESSION]-->(ChatSession)--[:HAS_MESSAGE]-->(Message1)--[:NEXT]-->(Message2)--[:NEXT]-->(Message3)
```

### 2.3 Cypher 查询示例

#### 创建用户
```cypher
CREATE (u:User {
  id: $id,
  username: $username,
  email: $email,
  passwordHash: $passwordHash,
  createdAt: datetime(),
  updatedAt: datetime()
})
RETURN u
```

#### 根据用户名或邮箱查找用户
```cypher
MATCH (u:User)
WHERE u.username = $loginId OR u.email = $loginId
RETURN u
```

#### 创建聊天会话
```cypher
MATCH (u:User {id: $userId})
CREATE (s:ChatSession {
  id: $sessionId,
  title: $title,
  createdAt: datetime(),
  updatedAt: datetime()
})
CREATE (u)-[:HAS_SESSION]->(s)
RETURN s
```

#### 添加消息到会话
```cypher
MATCH (s:ChatSession {id: $sessionId})
CREATE (m:Message {
  id: $messageId,
  role: $role,
  content: $content,
  createdAt: datetime()
})
CREATE (s)-[:HAS_MESSAGE]->(m)
WITH s, m
OPTIONAL MATCH (s)-[:HAS_MESSAGE]->(prev:Message)
WHERE prev.id <> m.id AND NOT (prev)-[:NEXT]->()
FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
  CREATE (prev)-[:NEXT]->(m)
)
RETURN m
```

#### 获取用户的所有会话（按最后活跃时间倒序）
```cypher
MATCH (u:User {id: $userId})-[:HAS_SESSION]->(s:ChatSession)
RETURN s
ORDER BY s.updatedAt DESC
```

#### 获取会话的所有消息（按顺序）
```cypher
MATCH (s:ChatSession {id: $sessionId})-[:HAS_MESSAGE]->(m:Message)
RETURN m
ORDER BY m.createdAt ASC
```

#### 删除会话及其所有消息
```cypher
MATCH (s:ChatSession {id: $sessionId})
OPTIONAL MATCH (s)-[:HAS_MESSAGE]->(m:Message)
DETACH DELETE m, s
```

---

## 3. API 设计

### 3.1 POST /api/auth/register - 用户注册

**请求体：**
```json
{
  "username": "string (3-20位，字母数字下划线)",
  "email": "string (有效邮箱格式)",
  "password": "string (至少8位，包含字母和数字)"
}
```

**成功响应 (201)：**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string"
  }
}
```
- 同时在响应头设置 `Set-Cookie` 写入 JWT Token

**错误响应 (400)：**
```json
{
  "success": false,
  "error": "用户名已存在" | "邮箱已被注册" | "参数校验失败"
}
```

### 3.2 POST /api/auth/login - 用户登录

**请求体：**
```json
{
  "loginId": "string (用户名或邮箱)",
  "password": "string"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string"
  }
}
```
- 同时在响应头设置 `Set-Cookie` 写入 JWT Token

**错误响应 (401)：**
```json
{
  "success": false,
  "error": "用户名或密码错误"
}
```

### 3.3 POST /api/auth/logout - 用户登出

**成功响应 (200)：**
```json
{
  "success": true
}
```
- 清除 Cookie 中的 JWT Token

### 3.4 GET /api/auth/me - 获取当前用户信息

**请求头：** Cookie 中携带 JWT Token（浏览器自动携带）

**成功响应 (200)：**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string"
  }
}
```

**未认证响应 (401)：**
```json
{
  "success": false,
  "error": "未登录"
}
```

### 3.5 POST /api/chat - 聊天（修改现有接口）

在现有聊天 API 基础上增加：
- 认证检查：从 Cookie 中验证 JWT Token，提取用户 ID
- 新增可选参数 `sessionId`：指定会话 ID（不传则创建新会话）
- 消息持久化：将用户消息和 AI 回复存入 Neo4j
- 返回 `sessionId` 在响应头 `X-Session-Id` 中

**请求体（修改后）：**
```json
{
  "messages": [
    { "role": "user", "content": "string" },
    { "role": "assistant", "content": "string" }
  ],
  "sessionId": "string (可选，不传则创建新会话)"
}
```

**响应：**
- Body：保持原有的流式文本响应不变
- Header 新增：`X-Session-Id: <sessionId>`

### 3.6 GET /api/chat/history - 获取聊天会话列表

**请求头：** Cookie 中携带 JWT Token

**成功响应 (200)：**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "uuid",
      "title": "string",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

### 3.7 GET /api/chat/history/[sessionId] - 获取指定会话的消息

**请求头：** Cookie 中携带 JWT Token

**成功响应 (200)：**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "title": "string"
  },
  "messages": [
    {
      "id": "uuid",
      "role": "user" | "assistant",
      "content": "string",
      "createdAt": "ISO8601"
    }
  ]
}
```

**权限校验：** 只能查看自己的会话，否则返回 404

---

## 4. 前端页面设计

### 4.1 /login - 登录页面

- 居中卡片式布局，与项目整体风格一致
- 表单字段：
  - 用户名/邮箱输入框
  - 密码输入框
  - "登录" 提交按钮
- 底部提供「没有账号？去注册」链接跳转到 `/register`
- 表单验证：前端基础校验 + 后端返回错误展示
- 登录成功后跳转到 `/chat`

### 4.2 /register - 注册页面

- 居中卡片式布局，与登录页风格统一
- 表单字段：
  - 用户名输入框（3-20位，字母数字下划线）
  - 邮箱输入框
  - 密码输入框
  - 确认密码输入框
  - "注册" 提交按钮
- 底部提供「已有账号？去登录」链接跳转到 `/login`
- 实时密码强度提示
- 注册成功后自动登录并跳转到 `/chat`

### 4.3 /chat - 聊天页面（修改）

在现有聊天页面基础上增加：
- 页面顶部导航栏：
  - 左侧：项目 Logo / 标题 "AI 客服聊天系统"
  - 右侧：显示当前用户名 + "退出" 按钮
- 左侧边栏（可折叠）：
  - "新建对话" 按钮
  - 历史会话列表（显示标题和时间）
  - 点击会话加载历史消息
  - 当前活跃会话高亮
- 主区域：保持现有聊天功能不变
- 认证检查：页面加载时验证登录状态，未登录则跳转 `/login`

### 4.4 全局布局修改

- `app/layout.tsx` 中添加 `AuthProvider` 上下文提供者
- 创建 `AuthContext` 管理全局用户状态
- 提供 `useAuth()` Hook 供各组件使用

### 4.5 导航栏组件

- 显示在需要认证的页面顶部
- 包含用户头像占位 / 用户名
- 包含退出登录按钮
- 响应式设计，移动端适配

---

## 5. 涉及文件清单

### 5.1 新建文件

| 文件路径 | 说明 |
|----------|------|
| `lib/neo4j.ts` | Neo4j 数据库连接管理（单例模式） |
| `lib/auth.ts` | JWT 工具函数（签发、验证、从请求中提取用户） |
| `lib/validations.ts` | 输入校验工具函数 |
| `app/api/auth/register/route.ts` | 用户注册 API |
| `app/api/auth/login/route.ts` | 用户登录 API |
| `app/api/auth/logout/route.ts` | 用户登出 API |
| `app/api/auth/me/route.ts` | 获取当前用户信息 API |
| `app/api/chat/history/route.ts` | 获取聊天会话列表 API |
| `app/api/chat/history/[sessionId]/route.ts` | 获取指定会话消息 API |
| `app/login/page.tsx` | 登录页面 |
| `app/register/page.tsx` | 注册页面 |
| `app/contexts/AuthContext.tsx` | 认证上下文 + useAuth Hook |
| `app/components/Navbar.tsx` | 导航栏组件 |
| `app/components/ChatSidebar.tsx` | 聊天会话侧边栏组件 |
| `middleware.ts` | Next.js 中间件，路由权限控制 |

### 5.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `app/layout.tsx` | 包裹 `AuthProvider`，调整布局 |
| `app/chat/page.tsx` | 添加认证检查、会话管理、侧边栏集成、导航栏 |
| `app/api/chat/route.ts` | 添加认证校验、消息持久化、会话管理 |
| `package.json` | 添加新依赖 |
| `.env.local` | 添加 Neo4j 和 JWT 相关环境变量 |

### 5.3 环境变量（.env.local 新增）

```bash
# Neo4j 数据库连接
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# JWT 密钥
JWT_SECRET=your-jwt-secret-key-change-in-production
```

---

## 6. 技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| `neo4j-driver` | ^5.x | Neo4j 官方 Node.js 驱动，连接和操作图数据库 |
| `bcryptjs` | ^2.x | 纯 JS 实现的 bcrypt，用于密码加密（无需编译原生模块） |
| `jsonwebtoken` | ^9.x | JWT Token 签发和验证 |
| `uuid` | ^11.x | 生成 UUID 作为节点唯一标识 |

### 选型理由

- **neo4j-driver**: Neo4j 官方维护的 Node.js 驱动，支持 Bolt 协议，API 稳定，TypeScript 类型完善。相比 OGM 或其他抽象层，直接使用驱动更灵活，且对于本项目的数据模型（用户-会话-消息）足够简洁。
- **bcryptjs**: 纯 JavaScript 实现，不依赖原生 C++ 编译。在 Vercel Serverless 环境中兼容性好，避免 `bcrypt` 原生模块在不同部署平台上可能出现的编译问题。
- **jsonwebtoken**: Node.js 生态中最成熟的 JWT 库，社区活跃，支持多种签名算法。配合 HttpOnly Cookie 使用，比将 Token 存储在 localStorage 更安全。
- **uuid**: 使用 UUID v4 生成随机唯一标识符，避免使用 Neo4j 内部 ID（内部 ID 可能被复用），保证节点标识的全局唯一性和稳定性。
- **Next.js Middleware**: 内置的中间件机制，运行在 Edge Runtime，可以在请求到达页面/API 之前进行拦截，非常适合做统一的路由权限控制。无需引入额外的认证框架（如 NextAuth），保持方案轻量可控。

---

## 7. 验收标准

### 7.1 用户注册

- [ ] 可以使用用户名、邮箱、密码成功注册新用户
- [ ] 注册时用户名重复返回明确错误提示
- [ ] 注册时邮箱重复返回明确错误提示
- [ ] 密码不满足强度要求时前端和后端均有校验提示
- [ ] 注册成功后自动登录并跳转到 `/chat` 页面
- [ ] 密码在 Neo4j 中以 bcrypt 哈希形式存储

### 7.2 用户登录

- [ ] 使用正确的用户名 + 密码可以成功登录
- [ ] 使用正确的邮箱 + 密码可以成功登录
- [ ] 错误的密码返回统一错误信息（不泄露用户是否存在）
- [ ] 登录成功后 JWT Token 存储在 HttpOnly Cookie 中
- [ ] 登录成功后跳转到 `/chat` 页面

### 7.3 认证与权限

- [ ] 未登录用户访问 `/chat` 被重定向到 `/login`
- [ ] 未登录用户请求 `/api/chat` 返回 401
- [ ] 已登录用户访问 `/login` 被重定向到 `/chat`
- [ ] JWT Token 过期后用户需要重新登录
- [ ] 点击"退出"按钮可以成功登出，Cookie 被清除

### 7.4 聊天功能

- [ ] 登录后可以正常发送消息并收到 AI 流式响应（原有功能不受影响）
- [ ] 发送的消息和 AI 回复被保存到 Neo4j 数据库
- [ ] 首次发送消息时自动创建新的聊天会话
- [ ] 左侧边栏显示历史会话列表
- [ ] 点击历史会话可以加载并查看之前的对话
- [ ] 可以在历史会话中继续对话
- [ ] 点击"新建对话"按钮可以开始新的会话

### 7.5 数据安全

- [ ] 密码使用 bcryptjs 加密存储，原文不可逆
- [ ] JWT Token 使用 HttpOnly Cookie 传输，前端 JavaScript 无法读取
- [ ] 用户只能查看自己的聊天会话和消息
- [ ] API 输入参数经过校验，防止注入攻击
- [ ] Neo4j 查询使用参数化查询，防止 Cypher 注入

### 7.6 用户体验

- [ ] 页面加载时有 loading 状态展示
- [ ] 表单提交时按钮禁用，防止重复提交
- [ ] 错误信息清晰友好，使用中文提示
- [ ] 页面响应式设计，移动端可正常使用
- [ ] 聊天侧边栏可以折叠/展开

### 7.7 部署兼容

- [ ] `npm run build` 构建成功，无类型错误
- [ ] `npm run lint` 检查通过
- [ ] 可在 Vercel 平台正常部署运行
- [ ] 环境变量通过 `.env.local`（本地）和 Vercel 环境变量（线上）配置
