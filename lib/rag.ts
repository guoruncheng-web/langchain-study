import { OpenAIEmbeddings } from "@langchain/openai";
import { NeonPostgres } from "@langchain/community/vectorstores/neon";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * 获取 DashScope text-embedding-v3 嵌入模型实例
 */
export function getEmbeddings() {
  return new OpenAIEmbeddings({
    model: "text-embedding-v3",
    dimensions: 1024,
    configuration: {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });
}

/**
 * 获取 Neon pgvector 向量存储实例
 */
export async function getVectorStore() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 环境变量未设置");
  }

  return NeonPostgres.initialize(getEmbeddings(), {
    connectionString,
    tableName: "vectorstore_documents",
  });
}

/**
 * 获取文本分块器（支持中文分隔符）
 */
export function getTextSplitter() {
  return new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", "。", "！", "？", "；", ".", "!", "?", ";", " ", ""],
  });
}
