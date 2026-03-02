import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { validateUsername, validateEmail, validatePassword } from "@/lib/validations";

// 管理员权限校验辅助函数
async function checkAdmin() {
  const payload = await getUserFromRequest();
  if (!payload) {
    return { error: NextResponse.json({ success: false, error: "未登录" }, { status: 401 }) };
  }
  if (payload.role !== "admin") {
    return { error: NextResponse.json({ success: false, error: "无权访问" }, { status: 403 }) };
  }
  return { payload };
}

// 获取用户列表（支持搜索）
export async function GET(request: NextRequest) {
  const { payload, error } = await checkAdmin();
  if (error || !payload) return error!;

  const sql = getSQL();
  const search = request.nextUrl.searchParams.get("search");

  let users;
  if (search) {
    const keyword = `%${search}%`;
    users = await sql`
      SELECT u.id, u.username, u.email, u.role,
             COALESCE(u.status, 'active') AS status,
             u.created_at,
             COUNT(cs.id)::int AS session_count
      FROM users u
      LEFT JOIN chat_sessions cs ON cs.user_id = u.id
      WHERE u.username ILIKE ${keyword} OR u.email ILIKE ${keyword}
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
  } else {
    users = await sql`
      SELECT u.id, u.username, u.email, u.role,
             COALESCE(u.status, 'active') AS status,
             u.created_at,
             COUNT(cs.id)::int AS session_count
      FROM users u
      LEFT JOIN chat_sessions cs ON cs.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
  }

  return NextResponse.json({
    success: true,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      sessionCount: u.session_count,
    })),
    total: users.length,
  });
}

// 新增用户（管理员创建账号）
export async function POST(request: NextRequest) {
  const { payload, error } = await checkAdmin();
  if (error || !payload) return error!;

  const body = await request.json();
  const { username, email, password, role = "user" } = body;

  // 校验用户名
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    return NextResponse.json({ success: false, error: usernameCheck.error }, { status: 400 });
  }

  // 校验邮箱
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    return NextResponse.json({ success: false, error: emailCheck.error }, { status: 400 });
  }

  // 校验密码
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ success: false, error: passwordCheck.error }, { status: 400 });
  }

  // 校验角色
  if (role !== "user" && role !== "admin") {
    return NextResponse.json({ success: false, error: "无效的角色值" }, { status: 400 });
  }

  const sql = getSQL();
  const lowerUsername = username.toLowerCase();
  const lowerEmail = email.toLowerCase();

  // 检查用户名唯一性
  const existingUser = await sql`SELECT id FROM users WHERE username = ${lowerUsername}`;
  if (existingUser.length > 0) {
    return NextResponse.json({ success: false, error: "用户名已存在" }, { status: 400 });
  }

  // 检查邮箱唯一性
  const existingEmail = await sql`SELECT id FROM users WHERE email = ${lowerEmail}`;
  if (existingEmail.length > 0) {
    return NextResponse.json({ success: false, error: "邮箱已被注册" }, { status: 400 });
  }

  // 加密密码
  const passwordHash = await bcrypt.hash(password, 10);

  // 创建用户
  const userId = uuidv4();
  await sql`
    INSERT INTO users (id, username, email, password_hash, role, status)
    VALUES (${userId}, ${lowerUsername}, ${lowerEmail}, ${passwordHash}, ${role}, 'active')
  `;

  return NextResponse.json({
    success: true,
    user: {
      id: userId,
      username: lowerUsername,
      email: lowerEmail,
      role,
      status: "active",
    },
  }, { status: 201 });
}
