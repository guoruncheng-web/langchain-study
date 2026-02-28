import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const payload = await getUserFromRequest();
  if (!payload) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  // 仅管理员可访问知识库
  if (payload.role !== 'admin') {
    return NextResponse.json({ success: false, error: "无权访问" }, { status: 403 });
  }

  const sql = getSQL();
  const documents = await sql`
    SELECT id, filename, file_size, chunk_count, status, created_at
    FROM kb_documents
    WHERE user_id = ${payload.userId}
    ORDER BY created_at DESC
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
    })),
  });
}
