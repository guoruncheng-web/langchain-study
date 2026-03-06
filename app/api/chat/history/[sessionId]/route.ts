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

// 删除指定会话
export async function DELETE(
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
    SELECT id FROM chat_sessions
    WHERE id = ${sessionId} AND user_id = ${payload.userId}
  `;

  if (sessionRows.length === 0) {
    return NextResponse.json(
      { success: false, error: "会话不存在" },
      { status: 404 }
    );
  }

  // 删除会话（messages 表有 ON DELETE CASCADE，会自动删除消息）
  await sql`DELETE FROM chat_sessions WHERE id = ${sessionId}`;

  return NextResponse.json({ success: true });
}

// 重命名指定会话
export async function PATCH(
  req: Request,
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
    SELECT id FROM chat_sessions
    WHERE id = ${sessionId} AND user_id = ${payload.userId}
  `;

  if (sessionRows.length === 0) {
    return NextResponse.json(
      { success: false, error: "会话不存在" },
      { status: 404 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体格式错误" },
      { status: 400 }
    );
  }
  const { title } = body;

  // 校验标题
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "标题不能为空" },
      { status: 400 }
    );
  }

  if (title.length > 100) {
    return NextResponse.json(
      { success: false, error: "标题不能超过100个字符" },
      { status: 400 }
    );
  }

  const trimmedTitle = title.trim();

  // 更新会话标题
  await sql`
    UPDATE chat_sessions SET title = ${trimmedTitle}, updated_at = NOW()
    WHERE id = ${sessionId}
  `;

  return NextResponse.json({ success: true, title: trimmedTitle });
}
