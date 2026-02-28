import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { getVectorStore, getTextSplitter } from "@/lib/rag";
import { Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_EXTENSIONS = [".txt", ".md"];

export async function POST(req: Request) {
  const payload = await getUserFromRequest();
  if (!payload) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  // 仅管理员可上传知识库文档
  if (payload.role !== 'admin') {
    return NextResponse.json({ success: false, error: "无权访问" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ success: false, error: "请上传文件" }, { status: 400 });
  }

  // 验证文件扩展名
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { success: false, error: "仅支持 .txt 和 .md 文件" },
      { status: 400 }
    );
  }

  // 验证文件大小
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: "文件大小不能超过 2MB" },
      { status: 400 }
    );
  }

  const documentId = uuidv4();
  const sql = getSQL();

  // 创建文档记录（状态: processing）
  await sql`
    INSERT INTO kb_documents (id, user_id, filename, file_size, status)
    VALUES (${documentId}, ${payload.userId}, ${file.name}, ${file.size}, 'processing')
  `;

  try {
    // 读取文件内容
    const text = await file.text();

    // 分块
    const splitter = getTextSplitter();
    const chunks = await splitter.splitText(text);

    // 构建 Document 列表，每个块带元数据
    const documents = chunks.map(
      (chunk, index) =>
        new Document({
          pageContent: chunk,
          metadata: {
            documentId,
            userId: payload.userId,
            filename: file.name,
            chunkIndex: index,
          },
        })
    );

    // 向量化并入库
    const vectorStore = await getVectorStore();
    await vectorStore.addDocuments(documents);

    // 更新文档状态为 ready
    await sql`
      UPDATE kb_documents SET status = 'ready', chunk_count = ${chunks.length}
      WHERE id = ${documentId}
    `;

    return NextResponse.json({
      success: true,
      document: {
        id: documentId,
        filename: file.name,
        fileSize: file.size,
        chunkCount: chunks.length,
        status: "ready",
      },
    });
  } catch (error) {
    console.error("文档处理失败:", error);
    // 更新文档状态为 error
    await sql`UPDATE kb_documents SET status = 'error' WHERE id = ${documentId}`;

    return NextResponse.json(
      { success: false, error: "文档处理失败" },
      { status: 500 }
    );
  }
}
