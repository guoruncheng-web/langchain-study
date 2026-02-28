import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";

// 获取指定会话的消息历史
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const payload = await getUserFromRequest();

  if (!payload) {
    return NextResponse.json(
      { success: false, error: "未登录" },
      { status: 401 }
    );
  }

  const { sessionId } = await params;
  const sql = getSQL();

  // 验证会话属于当前用户
  const sessionRows = await sql`
    SELECT id, title FROM chat_sessions
    WHERE id = ${sessionId} AND user_id = ${payload.userId}
  `;

  if (sessionRows.length === 0) {
    return NextResponse.json(
      { success: false, error: "会话不存在" },
      { status: 404 }
    );
  }

  const chatSession = sessionRows[0];

  // 查询会话的所有消息
  const messageRows = await sql`
    SELECT id, role, content, created_at
    FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `;

  const messages = messageRows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at?.toString() || "",
  }));

  return NextResponse.json({
    success: true,
    session: { id: chatSession.id, title: chatSession.title },
    messages,
  });
}
