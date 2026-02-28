import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";

// 获取当前登录用户信息
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
    SELECT id, username, email, role FROM users WHERE id = ${payload.userId}
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "用户不存在" },
      { status: 401 }
    );
  }

  const user = rows[0];
  return NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, email: user.email, role: user.role || 'user' },
  });
}
