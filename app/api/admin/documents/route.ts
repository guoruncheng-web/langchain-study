import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { NextResponse } from "next/server";

// 获取所有知识库文档
export async function GET() {
  // 认证校验
  const payload = await getUserFromRequest();
  if (!payload) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  // 权限校验：仅 admin
  if (payload.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权访问" }, { status: 403 });
  }

  const sql = getSQL();
  const documents = await sql`
    SELECT d.id, d.filename, d.file_size, d.chunk_count, d.status, d.created_at,
           u.username AS uploader
    FROM kb_documents d
    JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC
  `;

  return NextResponse.json({
    success: true,
    documents: documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      fileSize: doc.file_size,
      chunkCount: doc.chunk_count,
      status: doc.status,
      createdAt: doc.created_at,
      username: doc.uploader,
    })),
    total: documents.length,
  });
}
