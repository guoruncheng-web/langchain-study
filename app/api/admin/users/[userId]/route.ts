import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// 修改用户角色或状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // 认证校验
  const payload = await getUserFromRequest();
  if (!payload) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  // 权限校验：仅 admin
  if (payload.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权访问" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await request.json();
  const { role, status } = body;

  // 至少提供一个修改字段
  if (role === undefined && status === undefined) {
    return NextResponse.json({ success: false, error: "请提供要修改的字段" }, { status: 400 });
  }

  // 校验角色值
  if (role !== undefined && role !== "user" && role !== "admin") {
    return NextResponse.json({ success: false, error: "无效的角色值" }, { status: 400 });
  }

  // 校验状态值
  if (status !== undefined && status !== "active" && status !== "disabled") {
    return NextResponse.json({ success: false, error: "无效的状态值" }, { status: 400 });
  }

  // 不能修改自己的角色
  if (role !== undefined && payload.userId === userId) {
    return NextResponse.json({ success: false, error: "不能修改自己的角色" }, { status: 400 });
  }

  // 不能禁用自己
  if (status === "disabled" && payload.userId === userId) {
    return NextResponse.json({ success: false, error: "不能禁用自己的账号" }, { status: 400 });
  }

  const sql = getSQL();

  // 检查目标用户是否存在
  const existing = await sql`
    SELECT id, username, role, COALESCE(status, 'active') AS status
    FROM users WHERE id = ${userId}
  `;
  if (existing.length === 0) {
    return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
  }

  // 合并更新字段
  const newRole = role ?? existing[0].role;
  const newStatus = status ?? existing[0].status;

  await sql`
    UPDATE users SET role = ${newRole}, status = ${newStatus}, updated_at = NOW()
    WHERE id = ${userId}
  `;

  return NextResponse.json({
    success: true,
    user: {
      id: userId,
      username: existing[0].username,
      role: newRole,
      status: newStatus,
    },
  });
}
