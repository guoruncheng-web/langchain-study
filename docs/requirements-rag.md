# RAG 知识库检索增强生成需求文档

> 版本: 1.1
> 日期: 2026-02-28
> 项目: AI 客服聊天系统 (Next.js 16 + LangChain)

---

## 目录

1. [功能概述](#1-功能概述)
2. [现有实现盘点](#2-现有实现盘点)
3. [详细功能需求](#3-详细功能需求)
4. [技术方案](#4-技术方案)
5. [数据库表设计](#5-数据库表设计)
6. [API 接口设计](#6-api-接口设计)
7. [前端页面设计](#7-前端页面设计)
8. [涉及文件清单](#8-涉及文件清单)
9. [验收标准](#9-验收标准)

---

## 1. 功能概述

### 1.1 目标

在现有 AI 客服聊天系统中引入 RAG（Retrieval-Augmented Generation，检索增强生成）功能，允许用户上传自己的知识库文档，AI 在回答问题时优先参考用户知识库中的内容，从而提供更准确、更贴合用户业务的回答。

### 1.2 核心能力

- **文档管理**：用户可以上传、查看、删除知识库文档（支持 TXT、Markdown 格式）
- **文档向量化**：上传的文档自动分块、向量化并存储到 pgvector 向量数据库
- **检索增强回答**：聊天时自动检索用户知识库中的相关内容，作为上下文注入给 AI 模型
- **用户隔离**：每个用户拥有独立的知识库，互不干扰

### 1.3 用户场景

1. 用户登录后进入「知识库管理」页面，上传业务文档（产品手册、FAQ 等）
2. 上传的文档自动处理（分块 + 向量化），状态从 processing 变为 ready
3. 用户回到聊天页面提问，AI 会自动检索知识库中相关内容辅助回答
4. 如果知识库中有相关信息，AI 优先基于知识库回答；如果没有，则基于自身知识回答

---

## 2. 现有实现盘点

项目中已有部分 RAG 功能的后端实现，需要补充前端知识库管理页面并完善整体流程。

### 2.1 已完成的部分

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 向量存储工具 | `lib/rag.ts` | 已完成 | 封装了 DashScope `text-embedding-v3` 嵌入模型（1024维）、NeonPostgres 向量存储（表名 `vectorstore_documents`）、中文友好的文本分块器（800字/200字重叠） |
| 文档列表 API | `app/api/kb/route.ts` | 已完成 | GET 接口，返回当前用户的所有文档（含 id、filename、fileSize、chunkCount、status、createdAt），按 created_at DESC 排序 |
| 文档上传 API | `app/api/kb/upload/route.ts` | 已完成 | POST 接口，接收 multipart/form-data，支持 .txt/.md 文件上传，限制 2MB，自动分块向量化并更新 kb_documents 状态（processing → ready/error） |
| 文档删除 API | `app/api/kb/[documentId]/route.ts` | 已完成 | DELETE 接口，验证文档归属后删除 vectorstore_documents 中对应向量行（通过 metadata->>'documentId' 匹配）和 kb_documents 元数据记录 |
| 聊天 RAG 集成 | `app/api/chat/route.ts` | 已完成 | 聊天时基于用户最后一条消息调用 similaritySearch（top-3，按 userId 过滤），将相关内容作为 SystemMessage 注入。检索失败不影响正常聊天 |
| 数据库表 | `lib/db.ts` | 已完成 | kb_documents 表结构已在 initTables() 中定义，含 idx_kb_documents_user_id 索引 |
| API 路由保护 | `middleware.ts` | 已完成 | `/api/kb` 已加入 PROTECTED_ROUTES，matcher 已配置 `/api/kb/:path*` |

### 2.2 待实现的部分

| 模块 | 说明 |
|------|------|
| 知识库管理前端页面 | `app/kb/page.tsx`：展示文档列表、上传文档、删除文档 |
| 聊天页面导航入口 | 在聊天页面顶部导航栏增加「知识库」链接，跳转到 `/kb` |
| 页面路由保护 | `middleware.ts` 中将 `/kb` 加入 PROTECTED_ROUTES，matcher 添加 `/kb/:path*` |

---

## 3. 详细功能需求

### 3.1 知识库文档管理

#### 3.1.1 文档上传

- 用户可以通过页面上传 .txt 和 .md 文件
- 单文件大小限制 2MB
- 上传后显示处理状态：processing（处理中）→ ready（就绪）/ error（失败）
- 上传过程中显示加载动画，上传完成后自动刷新文档列表
- 上传失败显示错误信息

#### 3.1.2 文档列表展示

- 展示当前用户的所有知识库文档
- 每条文档显示：文件名、文件大小、分块数、状态、上传时间
- 按上传时间倒序排列（最新的在最前）
- 文档状态用不同颜色标识：
  - processing（处理中）：黄色
  - ready（就绪）：绿色
  - error（失败）：红色
- 空状态：当没有文档时显示友好提示

#### 3.1.3 文档删除

- 每条文档有删除按钮
- 删除前弹出确认对话框
- 删除后自动刷新文档列表
- 删除操作同时清除对应的向量数据（后端已实现）

### 3.2 与聊天功能的集成

#### 3.2.1 RAG 检索流程（已实现）

1. 用户发送聊天消息
2. 后端提取用户最后一条消息作为查询
3. 通过 pgvector 进行相似度搜索（top-3），过滤条件为当前用户的 userId
4. 如果检索到相关内容，将其以 `---` 分隔拼接后作为 SystemMessage 中的「参考资料」注入到消息列表头部
5. SystemMessage 提示词：`你是一个AI客服助手。请根据以下参考资料回答用户的问题。如果参考资料中没有相关信息，请根据自身知识回答。`

#### 3.2.2 导航集成

- 聊天页面顶部导航栏增加「知识库」链接，点击跳转到 `/kb`
- 知识库页面顶部导航栏有「返回聊天」链接，点击跳转到 `/chat`

---

## 4. 技术方案

### 4.1 向量数据库

**选型：Neon PostgreSQL + pgvector 扩展（通过 @langchain/community 的 NeonPostgres）**

选型理由：
- 复用现有 Neon PostgreSQL 数据库，无需引入额外的向量数据库服务
- pgvector 是 PostgreSQL 原生扩展，Neon 平台默认支持
- @langchain/community 已提供 `NeonPostgres` 向量存储集成
- 支持按 metadata 过滤（用于用户隔离）
- 适合中小规模知识库场景

### 4.2 嵌入模型

**选型：阿里云百炼平台 DashScope `text-embedding-v3`（1024 维）**

选型理由：
- 与项目已使用的 DashScope Qwen 模型平台一致，统一使用同一个 API Key（`OPENAI_API_KEY`）
- 通过 OpenAI 兼容模式调用（`@langchain/openai` 的 `OpenAIEmbeddings`，baseURL 为 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
- 对中文支持好，适合中文知识库场景
- 1024 维向量在准确性和存储成本之间取得平衡

### 4.3 文本分块策略

使用 LangChain 的 `RecursiveCharacterTextSplitter`：
- **chunkSize**: 800 字符
- **chunkOverlap**: 200 字符（25% 重叠，确保上下文连贯）
- **separators**: `["\n\n", "\n", "。", "！", "？", "；", ".", "!", "?", ";", " ", ""]`，优先按段落、换行、中文/英文句末标点拆分，保持语义完整

### 4.4 RAG 检索策略

- **检索方法**：相似度搜索（similarity search）
- **返回数量**：top-3 最相关文档块
- **过滤条件**：`{ userId: payload.userId }`，确保用户隔离
- **注入方式**：将检索到的文档块以 `\n---\n` 拼接，作为 SystemMessage 插入到 langchainMessages 列表头部
- **降级策略**：RAG 检索失败时 catch 异常并打印日志，不影响正常聊天

---

## 5. 数据库表设计

### 5.1 kb_documents 表（已实现）

知识库文档元数据表，记录用户上传的文档信息和处理状态。

```sql
CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_user_id ON kb_documents(user_id);
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 文档唯一标识 |
| user_id | UUID | NOT NULL, FK→users(id) ON DELETE CASCADE | 所属用户 ID，用户删除时级联删除 |
| filename | VARCHAR(255) | NOT NULL | 原始文件名 |
| file_size | INTEGER | NOT NULL | 文件大小（字节） |
| chunk_count | INTEGER | DEFAULT 0 | 分块数量，处理完成后更新 |
| status | VARCHAR(20) | DEFAULT 'processing' | 文档状态：`processing`（处理中）/ `ready`（就绪）/ `error`（失败） |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 上传时间 |

**索引**：`idx_kb_documents_user_id` — 加速按用户查询文档列表

### 5.2 vectorstore_documents 表（由 LangChain 自动管理）

向量存储表，由 `NeonPostgres.initialize()` 自动创建和管理。每条记录是一个文档块的向量化表示。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 向量记录唯一标识（LangChain 自动生成） |
| content | TEXT | 文本分块内容 |
| metadata | JSONB | 元数据 |
| embedding | VECTOR(1024) | 1024 维向量嵌入 |

**metadata 字段结构**：

```json
{
  "documentId": "kb_documents 表中的文档 UUID",
  "userId": "上传用户的 UUID（用于检索时的用户隔离过滤）",
  "filename": "原始文件名",
  "chunkIndex": 0
}
```

**关键操作**：
- 向量入库：`vectorStore.addDocuments(documents)` — 自动向量化并插入
- 相似性搜索：`vectorStore.similaritySearch(query, 3, { userId })` — 按用户过滤检索 top-3
- 向量删除：`DELETE FROM vectorstore_documents WHERE metadata->>'documentId' = $1` — 通过 SQL 直接操作

### 5.3 表关系

```
users (1) ──< kb_documents (N)              用户拥有多个知识库文档
kb_documents (1) ──< vectorstore_documents (N)  一个文档被分为多个向量块
                     （通过 metadata.documentId 关联，非外键约束）
```

---

## 6. API 接口设计

### 6.1 GET /api/kb — 获取知识库文档列表

**认证**：需要登录（Cookie JWT）

**请求参数**：无

**成功响应 (200)**：

```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "filename": "产品手册.txt",
      "fileSize": 102400,
      "chunkCount": 15,
      "status": "ready",
      "createdAt": "2026-02-28T10:00:00Z"
    }
  ]
}
```

**说明**：按 `created_at DESC` 排序，只返回当前用户的文档。

**实现文件**：`app/api/kb/route.ts`（已完成）

### 6.2 POST /api/kb/upload — 上传文档

**认证**：需要登录（Cookie JWT）

**请求体**：`Content-Type: multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 上传的文件（.txt 或 .md，最大 2MB） |

**成功响应 (200)**：

```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "filename": "产品手册.txt",
    "fileSize": 102400,
    "chunkCount": 15,
    "status": "ready"
  }
}
```

**错误响应**：

| 状态码 | 错误信息 | 场景 |
|--------|----------|------|
| 401 | `"未登录"` | 未携带有效 JWT |
| 400 | `"请上传文件"` | 未提供 file 字段 |
| 400 | `"仅支持 .txt 和 .md 文件"` | 文件扩展名不在 [.txt, .md] 中 |
| 400 | `"文件大小不能超过 2MB"` | 文件超过 2 * 1024 * 1024 字节 |
| 500 | `"文档处理失败"` | 分块或向量化过程出错（文档状态更新为 error） |

**处理流程**：
1. 校验登录状态
2. 校验文件扩展名和大小
3. 在 kb_documents 插入记录（status: `processing`）
4. 读取文件文本 → 分块 → 构建 Document 对象（附带 metadata: documentId, userId, filename, chunkIndex）
5. 调用 vectorStore.addDocuments() 向量化入库
6. 更新 kb_documents 状态为 `ready`，记录 chunk_count
7. 异常时更新状态为 `error`

**实现文件**：`app/api/kb/upload/route.ts`（已完成）

### 6.3 DELETE /api/kb/[documentId] — 删除文档

**认证**：需要登录（Cookie JWT）

**路径参数**：`documentId` (UUID)

**成功响应 (200)**：

```json
{
  "success": true
}
```

**错误响应**：

| 状态码 | 错误信息 | 场景 |
|--------|----------|------|
| 401 | `"未登录"` | 未携带有效 JWT |
| 404 | `"文档不存在或无权访问"` | 文档不存在或不属于当前用户 |

**删除流程**：
1. 校验登录状态
2. 查询 kb_documents 验证文档存在且属于当前用户
3. 删除 vectorstore_documents 中 `metadata->>'documentId'` 匹配的向量记录（失败不阻断）
4. 删除 kb_documents 中的文档元数据记录

**实现文件**：`app/api/kb/[documentId]/route.ts`（已完成）

### 6.4 API 总览

| 方法 | 路径 | 描述 | 认证 | 状态 |
|------|------|------|------|------|
| GET | /api/kb | 获取知识库文档列表 | 是 | 已实现 |
| POST | /api/kb/upload | 上传文档 | 是 | 已实现 |
| DELETE | /api/kb/[documentId] | 删除文档 | 是 | 已实现 |

---

## 7. 前端页面设计

### 7.1 /kb — 知识库管理页面（新增）

#### 7.1.1 页面布局

与聊天页面保持一致的整体风格（暗色模式支持、Tailwind CSS、响应式设计）。

```
+---------------------------------------------------------------+
| 顶部导航栏                                                      |
| [< 返回聊天]          知识库管理           [用户名] [退出]        |
+---------------------------------------------------------------+
|                                                               |
|  +----------------------------------------------------------+ |
|  | 上传区域                                                    | |
|  | +------------------------------------------------------+ | |
|  | |  点击上传文件                                          | | |
|  | |  支持 .txt、.md 文件，最大 2MB                         | | |
|  | +------------------------------------------------------+ | |
|  +----------------------------------------------------------+ |
|                                                               |
|  +----------------------------------------------------------+ |
|  | 文档列表                                                    | |
|  | +------------------------------------------------------+ | |
|  | | 文件名        大小    分块数  状态     上传时间   操作    | | |
|  | | faq.txt      10KB    5      已就绪   2/28      [删除]  | | |
|  | | guide.md     25KB    12     已就绪   2/27      [删除]  | | |
|  | | intro.txt    --      --     处理中   2/28      --      | | |
|  | +------------------------------------------------------+ | |
|  +----------------------------------------------------------+ |
|                                                               |
+---------------------------------------------------------------+
```

#### 7.1.2 顶部导航栏

- 左侧：「返回聊天」链接（`<Link href="/chat">`），点击返回聊天页面
- 中间：页面标题「知识库管理」
- 右侧：显示当前用户名 + 「退出」按钮（复用 AuthContext 的 logout 方法）

#### 7.1.3 文件上传区域

- 点击触发文件选择对话框（`<input type="file" accept=".txt,.md">`）
- 显示上传提示文字：「点击上传文件」和「支持 .txt、.md 文件，最大 2MB」
- 上传中显示加载状态（按钮禁用 + 「上传中...」文字）
- 上传成功后自动刷新文档列表
- 上传失败显示错误提示

#### 7.1.4 文档列表

以表格形式展示，包含以下列：

| 列 | 数据来源 | 说明 |
|----|----------|------|
| 文件名 | `filename` | 原始上传文件名 |
| 大小 | `fileSize` | 格式化为人类可读格式（如 10.2 KB、1.5 MB） |
| 分块数 | `chunkCount` | 文档被分为几个向量块 |
| 状态 | `status` | 用颜色标签区分：处理中（黄色）/ 已就绪（绿色）/ 失败（红色） |
| 上传时间 | `createdAt` | 格式化日期时间 |
| 操作 | - | 删除按钮（仅 ready 和 error 状态可删除） |

**空状态**：文档列表为空时，显示提示文字「暂无知识库文档，请上传文件」

**删除确认**：点击删除按钮后弹出确认对话框（`window.confirm`），确认后调用 DELETE API 并刷新列表

**自动刷新**：页面加载时自动获取文档列表；上传/删除操作后自动刷新

#### 7.1.5 认证检查

- 使用 `useAuth()` Hook 获取用户登录状态
- 未登录时重定向到 `/login`（与聊天页面逻辑一致）
- 页面加载中显示 loading 状态

#### 7.1.6 移动端适配

- 文档列表在小屏幕下改为卡片式布局或水平滚动表格
- 上传区域宽度自适应
- 导航栏响应式

### 7.2 聊天页面导航修改（修改 /chat）

在 `app/chat/page.tsx` 的顶部导航栏（`<header>`）右侧区域，在用户名左侧添加「知识库」链接：

```
修改前：[用户名] [退出]
修改后：[知识库] [用户名] [退出]
```

- 使用 Next.js `<Link href="/kb">` 实现页面跳转
- 样式与导航栏中其他元素一致（text-sm, text-gray-600, hover 效果）

### 7.3 路由保护补全

在 `middleware.ts` 中：
- `PROTECTED_ROUTES` 数组添加 `"/kb"`
- `config.matcher` 数组添加 `"/kb/:path*"`
- 效果：未登录用户访问 `/kb` 时自动重定向到 `/login`

---

## 8. 涉及文件清单

### 8.1 新增文件

| 文件路径 | 说明 |
|----------|------|
| `app/kb/page.tsx` | 知识库管理页面（文档上传、列表、删除） |

### 8.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `app/chat/page.tsx` | 顶部导航栏右侧增加「知识库」链接（`<Link href="/kb">`） |
| `middleware.ts` | PROTECTED_ROUTES 添加 `"/kb"`，config.matcher 添加 `"/kb/:path*"` |

### 8.3 无需修改的文件（已实现）

| 文件路径 | 说明 |
|----------|------|
| `lib/rag.ts` | 向量存储、嵌入模型、文本分块器 |
| `lib/db.ts` | 数据库连接和 kb_documents 表初始化 |
| `app/api/kb/route.ts` | 文档列表 API（GET） |
| `app/api/kb/upload/route.ts` | 文档上传 API（POST） |
| `app/api/kb/[documentId]/route.ts` | 文档删除 API（DELETE） |
| `app/api/chat/route.ts` | 聊天 API（已集成 RAG 检索） |

---

## 9. 验收标准

### 9.1 知识库文档管理

- [ ] 知识库管理页面可以正常访问（`/kb`）
- [ ] 未登录用户访问 `/kb` 被重定向到 `/login`
- [ ] 可以通过点击上传按钮选择 .txt 或 .md 文件上传
- [ ] 上传 .txt 文件成功，文档列表刷新，状态变为「已就绪」
- [ ] 上传 .md 文件成功，文档列表刷新，状态变为「已就绪」
- [ ] 上传非 .txt/.md 文件时显示错误提示「仅支持 .txt 和 .md 文件」
- [ ] 上传超过 2MB 的文件时显示错误提示「文件大小不能超过 2MB」
- [ ] 上传中按钮显示加载状态，防止重复提交
- [ ] 文档列表正确展示所有已上传文档（文件名、大小、分块数、状态、时间）
- [ ] 文档列表按上传时间倒序排列（最新的在最前面）
- [ ] 文档状态用不同颜色标签正确显示（处理中黄色、就绪绿色、失败红色）
- [ ] 可以删除文档，删除前有确认提示
- [ ] 删除后文档从列表消失，列表自动刷新
- [ ] 没有文档时显示空状态提示

### 9.2 RAG 检索增强（已实现，需验证）

- [ ] 上传文档后，在聊天中提问相关问题，AI 能基于文档内容回答
- [ ] AI 回答时优先参考知识库内容
- [ ] 知识库中无相关内容时，AI 基于自身知识回答（不报错）
- [ ] 用户 A 的知识库文档不会影响用户 B 的检索结果（用户隔离）
- [ ] 删除文档后，对应的向量数据被清除，不再影响后续检索
- [ ] RAG 检索失败时聊天功能不受影响（静默降级）

### 9.3 导航与路由

- [ ] 聊天页面顶部导航栏显示「知识库」链接
- [ ] 点击「知识库」跳转到 `/kb` 页面
- [ ] 知识库页面顶部有「返回聊天」链接，点击跳转到 `/chat`
- [ ] `/kb` 页面路由受 middleware 保护（未登录重定向到 `/login`）
- [ ] `/api/kb` 系列接口受 middleware 保护（未登录返回 401）

### 9.4 用户体验

- [ ] 页面加载时有 loading 状态
- [ ] 上传中有加载状态反馈
- [ ] 错误信息清晰友好（中文提示）
- [ ] 页面响应式设计，移动端可正常使用
- [ ] 支持暗色模式（`dark:` 前缀样式）
- [ ] 页面风格与聊天页面保持一致（颜色、字体、间距）
- [ ] 文件大小以人类可读格式显示（如 10.2 KB、1.5 MB）

### 9.5 部署兼容

- [ ] `pnpm build` 构建成功，无类型错误
- [ ] `pnpm lint` 检查通过
- [ ] 可在 Vercel 平台正常部署运行
