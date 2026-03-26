import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { getVectorStore, getTextSplitter } from "@/lib/rag";
import { extractTextFromImage, isImageFile, getImageMimeType } from "@/lib/ocr";
import { Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];

export async function POST(req: Request) {
  const payload = await getUserFromRequest();
  if (!payload) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
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
      { success: false, error: "仅支持 .txt、.md、.pdf 和图片文件（jpg/png/webp）" },
      { status: 400 }
    );
  }

  // 验证文件大小
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: "文件大小不能超过 10MB" },
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
    // 读取文件内容（根据文件类型选择解析方式）
    let text: string;
    if (isImageFile(file.name)) {
      // 图片文件：使用 Qwen-VL OCR 提取文字
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mimeType = getImageMimeType(file.name);
      text = await extractTextFromImage(base64, mimeType);
      // 过滤掉"未检测到文字"的结果
      if (text.includes("未检测到文字")) {
        await sql`UPDATE kb_documents SET status = 'error' WHERE id = ${documentId}`;
        return NextResponse.json(
          { success: false, error: "图片中未检测到文字内容" },
          { status: 400 }
        );
      }
    } else if (ext === ".pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdf = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await pdf.getText();
      text = textResult.text;
      await pdf.destroy();
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      await sql`UPDATE kb_documents SET status = 'error' WHERE id = ${documentId}`;
      return NextResponse.json(
        { success: false, error: "文件内容为空或无法提取文本" },
        { status: 400 }
      );
    }

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
