import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";

// 获取当前用户的聊天会话列表
export async function GET() {
  const payload = await getUserFromRequest();

  if (!payload) {
    return NextResponse.json(
      { success: false, error: "未登录" },
      { status: 401 }
    );
  }

  const sql = getSQL();
  const rows = await sql`
    SELECT id, title, created_at, updated_at
    FROM chat_sessions
    WHERE user_id = ${payload.userId}
    ORDER BY updated_at DESC
  `;

  const sessions = rows.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.created_at?.toString() || "",
    updatedAt: s.updated_at?.toString() || "",
  }));

  return NextResponse.json({ success: true, sessions });
}
