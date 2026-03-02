import { neon } from "@neondatabase/serverless";

/**
 * 获取 Neon SQL 查询函数
 * 每次调用返回一个绑定了连接字符串的 sql 函数
 */
export function getSQL() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 环境变量未设置");
  }
  return neon(databaseUrl);
}

/**
 * 初始化数据库表结构
 * 应在应用首次启动时调用一次
 */
export async function initTables() {
  const sql = getSQL();

  // 创建用户表
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      username VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 创建聊天会话表
  await sql`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(100) DEFAULT '新对话',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 创建消息表
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 迁移：为用户表添加角色列
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`;

  // 迁移：为用户表添加状态列（active/disabled）
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`;

  // 创建索引加速查询
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`;

  // 启用 pgvector 扩展（RAG 向量存储依赖）
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // 创建知识库文档元数据表
  await sql`
    CREATE TABLE IF NOT EXISTS kb_documents (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      file_size INTEGER NOT NULL,
      chunk_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'processing',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_kb_documents_user_id ON kb_documents(user_id)`;

  // 创建向量存储表（LangChain NeonPostgres 使用，列名必须为 text）
  await sql`
    CREATE TABLE IF NOT EXISTS vectorstore_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      text TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding vector(1024)
    )
  `;
  // 兼容迁移：旧表可能使用了 content 列名，需重命名为 text
  try {
    await sql`ALTER TABLE vectorstore_documents RENAME COLUMN content TO text`;
  } catch {
    // 列名已经是 text，忽略错误
  }
  // 创建 HNSW 索引加速向量相似度检索
  await sql`
    CREATE INDEX IF NOT EXISTS idx_vectorstore_embedding
    ON vectorstore_documents
    USING hnsw (embedding vector_cosine_ops)
  `;
}
