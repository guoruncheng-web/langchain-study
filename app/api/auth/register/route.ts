import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getSQL } from "@/lib/db";
import { signToken, createAuthCookieOptions } from "@/lib/auth";
import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/validations";

// 用户注册 API
export async function POST(req: Request) {
  const { username, email, password } = await req.json();

  // 参数校验
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    return NextResponse.json(
      { success: false, error: usernameCheck.error },
      { status: 400 }
    );
  }

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    return NextResponse.json(
      { success: false, error: emailCheck.error },
      { status: 400 }
    );
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json(
      { success: false, error: passwordCheck.error },
      { status: 400 }
    );
  }

  const sql = getSQL();
  const lowerUsername = username.toLowerCase();
  const lowerEmail = email.toLowerCase();

  // 检查用户名是否已存在
  const existingUser = await sql`
    SELECT id FROM users WHERE username = ${lowerUsername}
  `;
  if (existingUser.length > 0) {
    return NextResponse.json(
      { success: false, error: "用户名已存在" },
      { status: 400 }
    );
  }

  // 检查邮箱是否已存在
  const existingEmail = await sql`
    SELECT id FROM users WHERE email = ${lowerEmail}
  `;
  if (existingEmail.length > 0) {
    return NextResponse.json(
      { success: false, error: "邮箱已被注册" },
      { status: 400 }
    );
  }

  // 加密密码
  const passwordHash = await bcrypt.hash(password, 10);

  // 创建用户
  const userId = uuidv4();
  await sql`
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES (${userId}, ${lowerUsername}, ${lowerEmail}, ${passwordHash}, ${'user'})
  `;

  // 签发 JWT Token（包含角色信息）
  const token = signToken({ userId, username: lowerUsername, role: 'user' });
  const cookieOptions = createAuthCookieOptions(token);

  const response = NextResponse.json(
    {
      success: true,
      user: { id: userId, username: lowerUsername, email: lowerEmail, role: 'user' },
    },
    { status: 201 }
  );

  response.cookies.set(cookieOptions);
  return response;
}
