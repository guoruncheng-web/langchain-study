import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSQL } from "@/lib/db";
import { signToken, createAuthCookieOptions } from "@/lib/auth";

// 用户登录 API
export async function POST(req: Request) {
  const { loginId, password } = await req.json();

  if (!loginId || !password) {
    return NextResponse.json(
      { success: false, error: "请输入用户名/邮箱和密码" },
      { status: 400 }
    );
  }

  const sql = getSQL();
  const lowerId = loginId.toLowerCase();

  // 根据用户名或邮箱查找用户
  const rows = await sql`
    SELECT id, username, email, password_hash, role
    FROM users
    WHERE username = ${lowerId} OR email = ${lowerId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    // 统一错误信息，防止枚举攻击
    return NextResponse.json(
      { success: false, error: "用户名或密码错误" },
      { status: 401 }
    );
  }

  const user = rows[0];

  // 验证密码
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return NextResponse.json(
      { success: false, error: "用户名或密码错误" },
      { status: 401 }
    );
  }

  // 签发 JWT Token（包含角色信息）
  const token = signToken({ userId: user.id, username: user.username, role: user.role || 'user' });
  const cookieOptions = createAuthCookieOptions(token);

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, email: user.email, role: user.role || 'user' },
  });

  response.cookies.set(cookieOptions);
  return response;
}
