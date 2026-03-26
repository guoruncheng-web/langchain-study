import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSQL } from "@/lib/db";
import { signToken, createAuthCookieOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

function getSSOSecret() {
  const secret = process.env.SSO_SECRET;
  if (!secret) throw new Error("SSO_SECRET 环境变量未设置");
  return new TextEncoder().encode(secret);
}

/**
 * SSO 单点登录接口
 * 接收博客系统签发的 SSO token，自动创建/查找用户并登录，重定向到聊天页
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    // 验证博客签发的 SSO token
    const { payload } = await jwtVerify(token, getSSOSecret());
    const email = payload.email as string;
    if (!email) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const sql = getSQL();

    // 查找用户是否已存在
    const rows = await sql`
      SELECT id, username, role FROM users WHERE email = ${email} LIMIT 1
    `;

    let userId: string;
    let username: string;
    let role: string;

    if (rows.length > 0) {
      // 用户已存在，直接使用
      userId = rows[0].id;
      username = rows[0].username;
      role = rows[0].role || "user";
    } else {
      // 自动创建用户
      userId = crypto.randomUUID();
      username = email.split("@")[0];
      role = "user";
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

      await sql`
        INSERT INTO users (id, username, email, password_hash, role, status)
        VALUES (${userId}, ${username}, ${email}, ${passwordHash}, ${role}, 'active')
      `;
    }

    // 签发客服系统的 JWT
    const authToken = signToken({ userId, username, role });
    const cookieOptions = createAuthCookieOptions(authToken);

    // 重定向到聊天页
    const response = NextResponse.redirect(new URL("/chat", req.url));
    response.cookies.set(cookieOptions);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
