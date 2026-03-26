# 向量数据库设计与实施方案

> 版本: 1.0
> 日期: 2026-03-25
> 项目: AI 客服聊天系统 (Next.js 16 + LangChain)

---

## 目录

1. [功能描述](#1-功能描述)
2. [现有实现盘点](#2-现有实现盘点)
3. [技术方案选型与理由](#3-技术方案选型与理由)
4. [数据库 Schema 设计](#4-数据库-schema-设计)
5. [API 接口设计](#5-api-接口设计)
6. [与现有聊天功能的集成方式（RAG 流程）](#6-与现有聊天功能的集成方式rag-流程)
7. [涉及的文件变更清单](#7-涉及的文件变更清单)
8. [前端交互设计](#8-前端交互设计)
9. [待增强功能](#9-待增强功能)
10. [验收标准](#10-验收标准)

---

## 1. 功能描述

### 1.1 向量数据库的用途

向量数据库是 RAG（Retrieval-Augmented Generation，检索增强生成）架构的核心组件，在本项目中承担以下职责：

- **知识库存储**：将用户上传的文档分块后转化为高维向量（embedding），以结构化方式存储在数据库中
- **语义检索**：当用户发起聊天时，将用户问题向量化，通过余弦相似度在向量数据库中检索最相关的知识片段
- **RAG 增强回答**：将检索到的知识片段作为上下文注入到 AI 模型的提示词中，使 AI 的回答更准确、更贴合用户业务场景
- **用户隔离**：通过向量元数据中的 userId 字段实现多租户隔离，确保每个用户只能检索到自己上传的知识库内容

### 1.2 核心价值

| 能力 | 说明 |
|------|------|
| 企业知识导入 | 用户上传产品手册、FAQ、操作指南等文档，AI 即可基于这些内容回答问题 |
| 语义理解检索 | 不同于关键词匹配，向量检索能理解语义相似性（如"怎么退款"能匹配到"退货退款流程"） |
| 实时增强 | 无需重新训练模型，上传文档后立即生效 |
| 成本可控 | 复用现有数据库基础设施，无额外服务费用 |

---

## 2. 现有实现盘点

项目已完成向量数据库的核心功能实现，以下是各模块的当前状态：

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 向量存储工具 | `lib/rag.ts` | **已完成** | DashScope `text-embedding-v3` 嵌入模型（1024维）、NeonPostgres 向量存储、中文文本分块器 |
| 数据库表结构 | `lib/db.ts` | **已完成** | pgvector 扩展启用、`kb_documents` 和 `vectorstore_documents` 表、HNSW 索引 |
| 文档列表 API | `app/api/kb/route.ts` | **已完成** | GET 接口，返回当前用户的所有文档 |
| 文档上传 API | `app/api/kb/upload/route.ts` | **已完成** | POST 接口，支持 .txt/.md 文件上传、分块、向量化 |
| 文档删除 API | `app/api/kb/[documentId]/route.ts` | **已完成** | DELETE 接口，删除向量记录和文档元数据 |
| 聊天 RAG 集成 | `app/api/chat/route.ts` | **已完成** | 聊天时自动检索 top-3 相关文档块，作为系统提示注入 |
| 知识库前端页面 | `app/kb/page.tsx` | **待确认** | 文档上传、列表展示、删除功能的前端页面 |
| 管理后台文档管理 | `app/admin/documents/page.tsx` | **已完成** | 管理员查看所有用户的知识库文档 |
| 路由保护 | `middleware.ts` | **已完成** | `/api/kb` 和 `/kb` 已加入保护路由 |

---

## 3. 技术方案选型与理由

### 3.1 方案选型：Neon PostgreSQL + pgvector

**最终选型**：在现有 Neon PostgreSQL 数据库中启用 pgvector 扩展，通过 LangChain 的 `NeonPostgres` 向量存储集成进行操作。

### 3.2 方案对比

| 维度 | Neon pgvector（已选） | Pinecone | Weaviate | Chroma |
|------|----------------------|----------|----------|--------|
| 额外成本 | 无，复用现有 Neon 数据库 | 付费 SaaS，按向量数和查询量计费 | 需自建或付费云服务 | 需自建服务 |
| 部署复杂度 | 零，已在现有数据库中 | 低（SaaS），但需管理 API Key | 中（需部署容器或购买云服务） | 中（需部署服务） |
| 与现有架构兼容性 | 完美兼容，直接使用现有 DATABASE_URL | 需引入新连接和 SDK | 需引入新连接和 SDK | 需引入新连接和 SDK |
| LangChain 集成 | `@langchain/community` NeonPostgres | `@langchain/pinecone` | `@langchain/weaviate` | `@langchain/community` Chroma |
| 元数据过滤 | 支持（JSONB + GIN 索引） | 原生支持 | 原生支持 | 支持 |
| 向量索引 | HNSW（已配置） | 内置优化 | HNSW | HNSW |
| 适用规模 | 中小规模（百万级以内） | 大规模 | 大规模 | 小规模 |
| 数据一致性 | 强一致（PostgreSQL 事务） | 最终一致 | 最终一致 | 强一致 |
| Vercel 部署兼容 | 完美兼容（Serverless） | 兼容 | 兼容 | 不兼容（需本地服务） |

### 3.3 选型理由

1. **零额外成本**：pgvector 是 PostgreSQL 内置扩展，Neon 免费层即可使用，无需为向量数据库单独付费
2. **零运维开销**：无需部署、监控和维护额外的向量数据库服务，Neon 作为 Serverless 数据库自动扩缩容
3. **架构一致性**：业务数据（用户、会话、消息）和向量数据在同一个数据库中，便于事务管理和数据一致性保证
4. **简化部署**：仅需一个 `DATABASE_URL` 环境变量，与 Vercel 部署完美兼容
5. **LangChain 原生支持**：`@langchain/community` 提供 `NeonPostgres` 向量存储封装，API 简洁易用
6. **足够的性能**：HNSW 索引提供近似最近邻搜索，对于中小规模知识库（数万到数十万条文档块）性能完全够用
7. **中文支持好**：结合 DashScope `text-embedding-v3` 嵌入模型，对中文语义理解优秀

---

## 4. 数据库 Schema 设计

### 4.1 pgvector 扩展

```sql
-- 启用 pgvector 扩展（Neon 平台默认支持）
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4.2 kb_documents 表 — 知识库文档元数据

存储用户上传的文档信息和处理状态。

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

-- 索引：加速按用户查询文档列表
CREATE INDEX IF NOT EXISTS idx_kb_documents_user_id ON kb_documents(user_id);
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 文档唯一标识 |
| user_id | UUID | NOT NULL, FK→users(id) ON DELETE CASCADE | 所属用户，级联删除 |
| filename | VARCHAR(255) | NOT NULL | 原始文件名 |
| file_size | INTEGER | NOT NULL | 文件大小（字节） |
| chunk_count | INTEGER | DEFAULT 0 | 向量分块数量 |
| status | VARCHAR(20) | DEFAULT 'processing' | 状态：`processing` / `ready` / `error` |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 上传时间 |

### 4.3 vectorstore_documents 表 — 向量存储

存储文档分块的向量化表示，是向量检索的核心表。

```sql
CREATE TABLE IF NOT EXISTS vectorstore_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1024)
);

-- HNSW 索引：加速余弦相似度向量检索
CREATE INDEX IF NOT EXISTS idx_vectorstore_embedding
ON vectorstore_documents
USING hnsw (embedding vector_cosine_ops);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 向量记录唯一标识（自动生成） |
| text | TEXT | 文本分块内容（原文） |
| metadata | JSONB | 元数据（含 userId、documentId、filename、chunkIndex） |
| embedding | vector(1024) | 1024 维向量嵌入（DashScope text-embedding-v3 生成） |

**metadata 字段结构**：

```json
{
  "documentId": "kb_documents 表中的文档 UUID",
  "userId": "上传用户的 UUID（用于检索时的用户隔离过滤）",
  "filename": "原始文件名",
  "chunkIndex": 0
}
```

### 4.4 索引策略

| 索引名 | 表 | 类型 | 用途 |
|--------|------|------|------|
| `idx_kb_documents_user_id` | kb_documents | B-tree | 加速按用户 ID 查询文档列表 |
| `idx_vectorstore_embedding` | vectorstore_documents | HNSW (vector_cosine_ops) | 加速余弦相似度向量检索 |

**HNSW 索引说明**：
- HNSW（Hierarchical Navigable Small World）是一种近似最近邻搜索算法
- `vector_cosine_ops` 表示使用余弦距离作为相似度度量
- 相比暴力搜索，HNSW 在大数据量下查询速度提升数十倍，精度损失极小

### 4.5 表关系

```
users (1) ──< kb_documents (N)                 用户拥有多个知识库文档
kb_documents (1) ──< vectorstore_documents (N)  一个文档分为多个向量块
                     （通过 metadata->>'documentId' 关联，非外键约束）
```

---

## 5. API 接口设计

### 5.1 知识库管理 API

#### GET /api/kb — 获取知识库文档列表

| 项目 | 说明 |
|------|------|
| 认证 | 需要登录（Cookie JWT） |
| 请求参数 | 无 |
| 实现文件 | `app/api/kb/route.ts` |
| 状态 | **已实现** |

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
      "createdAt": "2026-03-25T10:00:00Z"
    }
  ]
}
```

#### POST /api/kb/upload — 上传文档

| 项目 | 说明 |
|------|------|
| 认证 | 需要登录（Cookie JWT） |
| Content-Type | multipart/form-data |
| 字段 | `file`：.txt 或 .md 文件，最大 2MB |
| 实现文件 | `app/api/kb/upload/route.ts` |
| 状态 | **已实现** |

**处理流程**：
1. 校验登录状态 → 校验文件类型和大小
2. 在 `kb_documents` 插入记录（status: `processing`）
3. 读取文件文本 → RecursiveCharacterTextSplitter 分块（800字/200字重叠）
4. 构建 LangChain Document 对象（附带 metadata: documentId, userId, filename, chunkIndex）
5. 调用 `vectorStore.addDocuments()` 向量化并入库
6. 更新 `kb_documents` 状态为 `ready`，记录 `chunk_count`
7. 异常时更新状态为 `error`

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

**错误场景**：

| 状态码 | 错误信息 | 场景 |
|--------|----------|------|
| 401 | `"未登录"` | 未携带有效 JWT |
| 400 | `"请上传文件"` | 未提供 file 字段 |
| 400 | `"仅支持 .txt 和 .md 文件"` | 文件扩展名不支持 |
| 400 | `"文件大小不能超过 2MB"` | 文件超过限制 |
| 500 | `"文档处理失败"` | 分块或向量化出错 |

#### DELETE /api/kb/[documentId] — 删除文档

| 项目 | 说明 |
|------|------|
| 认证 | 需要登录（Cookie JWT） |
| 路径参数 | `documentId` (UUID) |
| 实现文件 | `app/api/kb/[documentId]/route.ts` |
| 状态 | **已实现** |

**删除流程**：
1. 校验登录状态
2. 查询 `kb_documents` 验证文档存在且属于当前用户
3. 删除 `vectorstore_documents` 中 `metadata->>'documentId'` 匹配的向量记录
4. 删除 `kb_documents` 中的文档元数据记录

### 5.2 向量检索 API（内嵌于聊天 API）

向量检索功能内嵌在聊天 API `POST /api/chat` 中，无独立暴露的检索接口。

**检索逻辑**（在 `app/api/chat/route.ts` 中）：

```
用户消息 → text-embedding-v3 向量化 → pgvector 余弦相似度搜索（top-3, 按 userId 过滤）→ 检索结果拼接为系统提示
```

### 5.3 API 总览

| 方法 | 路径 | 描述 | 认证 | 状态 |
|------|------|------|------|------|
| GET | /api/kb | 获取知识库文档列表 | 是 | 已实现 |
| POST | /api/kb/upload | 上传文档并向量化 | 是 | 已实现 |
| DELETE | /api/kb/[documentId] | 删除文档及其向量数据 | 是 | 已实现 |
| POST | /api/chat | 聊天（含 RAG 向量检索） | 是 | 已实现 |

---

## 6. 与现有聊天功能的集成方式（RAG 流程）

### 6.1 RAG 整体架构

```
                         ┌──────────────────────────┐
                         │    知识库文档管理          │
                         │                          │
  用户上传文档 ──────────→ │  文本分块（800字/200重叠）  │
                         │        ↓                 │
                         │  DashScope Embedding      │
                         │  text-embedding-v3        │
                         │        ↓                 │
                         │  pgvector 向量入库         │
                         └──────────────────────────┘

                         ┌──────────────────────────┐
                         │    聊天 RAG 检索          │
                         │                          │
  用户发送消息 ──────────→ │  用户消息向量化            │
                         │        ↓                 │
                         │  pgvector 相似度搜索       │
                         │  (top-3, userId 过滤)     │
                         │        ↓                 │
                         │  检索结果注入 SystemMessage │
                         │        ↓                 │
                         │  Qwen 模型生成回答         │
                         │        ↓                 │
                         │  流式返回给前端            │
                         └──────────────────────────┘
```

### 6.2 检索流程详解

1. **用户发送消息**：前端 POST `/api/chat`，body 包含 messages 数组和 sessionId
2. **提取查询**：取 messages 中最后一条 role="user" 的消息作为检索查询
3. **向量检索**：调用 `vectorStore.similaritySearch(query, 3)`，在 `vectorstore_documents` 表中进行余弦相似度搜索，通过 metadata 中的 userId 过滤确保用户隔离
4. **构建上下文**：将检索到的最多 3 个文档块以 `\n---\n` 分隔拼接
5. **注入提示词**：如果有检索结果，在 langchainMessages 列表头部插入 SystemMessage：
   ```
   你是一个AI客服助手。请根据以下参考资料回答用户的问题。
   如果参考资料中没有相关信息，请根据自身知识回答。

   参考资料：
   {检索到的文档内容}
   ```
6. **模型推理**：调用 Qwen 模型（streaming 模式）生成回答
7. **流式返回**：通过 ReadableStream 实时将回答流式传输给前端
8. **降级策略**：RAG 检索失败时 catch 异常并记录日志，不影响正常聊天

### 6.3 嵌入模型配置

| 参数 | 值 | 说明 |
|------|------|------|
| 模型 | `text-embedding-v3` | 阿里云 DashScope 嵌入模型 |
| 维度 | 1024 | 向量维度 |
| API Base | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI 兼容模式 |
| API Key | `OPENAI_API_KEY` 环境变量 | 与 Qwen 模型共用同一个 Key |

### 6.4 文本分块策略

| 参数 | 值 | 说明 |
|------|------|------|
| chunkSize | 800 字符 | 每个分块的最大长度 |
| chunkOverlap | 200 字符 | 相邻分块的重叠长度（25%），保持上下文连贯 |
| 分隔符 | `\n\n`, `\n`, `。`, `！`, `？`, `；`, `.`, `!`, `?`, `;`, ` `, `` | 优先按段落、句子分割，中英文兼容 |

---

## 7. 涉及的文件变更清单

### 7.1 核心实现文件（已完成）

| 文件路径 | 说明 |
|----------|------|
| `lib/rag.ts` | 向量存储封装：嵌入模型、NeonPostgres 向量存储、文本分块器 |
| `lib/db.ts` | 数据库初始化：pgvector 扩展、kb_documents 表、vectorstore_documents 表、HNSW 索引 |
| `app/api/kb/route.ts` | 文档列表 API（GET） |
| `app/api/kb/upload/route.ts` | 文档上传 API（POST）：文件校验、文本分块、向量化入库 |
| `app/api/kb/[documentId]/route.ts` | 文档删除 API（DELETE）：向量记录清理、元数据删除 |
| `app/api/chat/route.ts` | 聊天 API：集成 RAG 检索，检索 top-3 相关文档块注入系统提示 |
| `middleware.ts` | 路由保护：`/api/kb` 和 `/kb` 路由认证 |

### 7.2 前端页面文件

| 文件路径 | 说明 | 状态 |
|----------|------|------|
| `app/kb/page.tsx` | 知识库管理页面（文档上传、列表展示、删除） | 待确认 |
| `app/chat/page.tsx` | 聊天页面导航栏增加「知识库」链接 | 待确认 |
| `app/admin/documents/page.tsx` | 管理后台文档管理页面 | 已完成 |

### 7.3 依赖包

| 包名 | 用途 | 状态 |
|------|------|------|
| `@langchain/community` | NeonPostgres 向量存储集成 | 已安装 |
| `@langchain/openai` | OpenAIEmbeddings 嵌入模型 | 已安装 |
| `@langchain/textsplitters` | RecursiveCharacterTextSplitter 文本分块 | 已安装 |
| `@neondatabase/serverless` | Neon PostgreSQL 连接 | 已安装 |

### 7.4 环境变量

| 变量名 | 用途 | 状态 |
|--------|------|------|
| `DATABASE_URL` | Neon PostgreSQL 连接字符串（同时用于业务数据和向量存储） | 已配置 |
| `OPENAI_API_KEY` | DashScope API Key（同时用于 Qwen 模型和 Embedding 模型） | 已配置 |

---

## 8. 前端交互设计

### 8.1 知识库管理页面（/kb）

#### 页面布局

```
+---------------------------------------------------------------+
| 顶部导航栏                                                      |
| [< 返回聊天]          知识库管理           [用户名] [退出]        |
+---------------------------------------------------------------+
|                                                               |
|  +----------------------------------------------------------+ |
|  | 上传区域                                                    | |
|  | +------------------------------------------------------+ | |
|  | |  点击或拖拽上传文件                                    | | |
|  | |  支持 .txt、.md 文件，最大 2MB                         | | |
|  | +------------------------------------------------------+ | |
|  +----------------------------------------------------------+ |
|                                                               |
|  +----------------------------------------------------------+ |
|  | 文档列表                                                    | |
|  | +------------------------------------------------------+ | |
|  | | 文件名        大小    分块数  状态     上传时间   操作    | | |
|  | | faq.txt      10KB    5      已就绪   3/25      [删除]  | | |
|  | | guide.md     25KB    12     已就绪   3/24      [删除]  | | |
|  | | intro.txt    --      --     处理中   3/25      --      | | |
|  | +------------------------------------------------------+ | |
|  +----------------------------------------------------------+ |
|                                                               |
+---------------------------------------------------------------+
```

#### 交互要点

- **上传**：点击上传区域触发文件选择，支持 .txt/.md 文件，上传中显示加载状态，完成后自动刷新列表
- **状态标识**：processing（黄色）、ready（绿色）、error（红色）
- **删除**：点击删除按钮，弹出确认对话框，确认后调用 API 删除并刷新列表
- **空状态**：无文档时显示「暂无知识库文档，请上传文件」
- **响应式**：移动端文档列表改为卡片布局

### 8.2 聊天页面导航

在聊天页面顶部导航栏的用户名左侧增加「知识库」链接，点击跳转到 `/kb` 页面。

---

## 9. 待增强功能

以下是基于当前实现可进一步增强的功能方向，按优先级排序：

### 9.1 高优先级

#### 支持更多文件格式

- **现状**：仅支持 .txt 和 .md 文件
- **增强**：支持 PDF、DOCX、CSV 等格式
- **方案**：引入 `pdf-parse`、`mammoth` 等解析库，在 upload API 中增加文件类型判断和对应的解析逻辑
- **涉及文件**：`app/api/kb/upload/route.ts`、`package.json`

#### 检索结果来源标注

- **现状**：AI 回答时不会标注参考了哪些文档
- **增强**：在 AI 回答末尾或侧边展示参考文档来源（文件名、分块序号）
- **方案**：在聊天 API 响应中额外返回检索到的文档元数据，前端展示引用来源
- **涉及文件**：`app/api/chat/route.ts`、`app/chat/page.tsx`

### 9.2 中优先级

#### 检索参数可配置

- **现状**：检索数量固定 top-3，无相似度阈值过滤
- **增强**：管理员可配置检索数量（top-k）和最低相似度阈值
- **方案**：在管理后台增加 RAG 配置项，聊天 API 读取配置动态调整检索参数

#### 知识库分类管理

- **现状**：用户所有文档平铺在一个列表中
- **增强**：支持创建知识库分类（如"产品手册"、"FAQ"、"操作指南"），文档按分类组织
- **方案**：新增 `kb_categories` 表，`kb_documents` 增加 category_id 外键

#### 文档更新（替换）

- **现状**：更新文档只能先删除再重新上传
- **增强**：支持直接替换某个文档的内容，自动清除旧向量并重新向量化
- **方案**：在 upload API 中支持 documentId 参数，存在时先删旧向量再入新向量

### 9.3 低优先级

#### 向量检索调试工具

- **现状**：无法直观看到检索结果的质量
- **增强**：管理后台提供检索测试工具，输入查询后展示 top-k 结果及相似度分数
- **方案**：新增 API `/api/admin/vector-search`，返回检索结果和分数

#### 批量上传

- **现状**：只能逐个文件上传
- **增强**：支持多文件同时上传或 ZIP 包上传
- **方案**：前端支持多文件选择，后端循环处理或解压后批量向量化

---

## 10. 验收标准

### 10.1 向量数据库基础功能

- [x] pgvector 扩展在 Neon 数据库中正确启用
- [x] `vectorstore_documents` 表结构正确（id, text, metadata, embedding vector(1024)）
- [x] HNSW 索引正确创建（`idx_vectorstore_embedding`，使用 `vector_cosine_ops`）
- [x] `kb_documents` 元数据表结构正确，索引已创建

### 10.2 文档管理流程

- [x] 上传 .txt 文件成功，分块后向量化存入 `vectorstore_documents`
- [x] 上传 .md 文件成功，分块后向量化存入 `vectorstore_documents`
- [x] 文档列表 API 正确返回当前用户的文档（含 filename、fileSize、chunkCount、status）
- [x] 删除文档时同时清除 `vectorstore_documents` 中对应的向量记录
- [x] 非 .txt/.md 文件上传时返回 400 错误
- [x] 超过 2MB 文件上传时返回 400 错误
- [x] 文档处理失败时状态更新为 `error`

### 10.3 RAG 检索增强

- [x] 聊天时自动检索用户知识库中相关内容（top-3）
- [x] 检索结果以 SystemMessage 形式注入到模型上下文
- [x] 用户隔离：用户 A 的知识库不会影响用户 B 的检索结果
- [x] RAG 检索失败时聊天功能不受影响（静默降级）
- [x] 知识库中无相关内容时，AI 基于自身知识正常回答

### 10.4 前端页面

- [ ] 知识库管理页面（`/kb`）可正常访问和操作
- [ ] 未登录用户访问 `/kb` 被重定向到 `/login`
- [ ] 聊天页面导航栏有「知识库」入口链接
- [ ] 管理后台可查看所有用户的知识库文档

### 10.5 部署兼容

- [ ] `pnpm build` 构建成功
- [ ] `pnpm lint` 检查通过
- [ ] Vercel 部署正常运行，向量检索功能在 Serverless 环境下工作正常
