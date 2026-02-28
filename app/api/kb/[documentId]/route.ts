import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const payload = await getUserFromRequest();
  if (!payload) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const { documentId } = await params;
  const sql = getSQL();

  // 验证文档归属
  const docs = await sql`
    SELECT id FROM kb_documents
    WHERE id = ${documentId} AND user_id = ${payload.userId}
  `;
  if (docs.length === 0) {
    return NextResponse.json(
      { success: false, error: "文档不存在或无权访问" },
      { status: 404 }
    );
  }

  // 删除向量存储中对应的向量行（通过 metadata 中的 documentId 匹配）
  try {
    await sql`
      DELETE FROM vectorstore_documents
      WHERE metadata->>'documentId' = ${documentId}
    `;
  } catch (error) {
    console.error("删除向量数据失败:", error);
    // vectorstore_documents 表可能不存在，不阻断
  }

  // 删除文档元数据记录
  await sql`DELETE FROM kb_documents WHERE id = ${documentId}`;

  return NextResponse.json({ success: true });
}
