import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// Cookie 名称
const COOKIE_NAME = "auth-token";

// JWT 有效期（7天）
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

// JWT payload 类型
export interface JwtPayload {
  userId: string;
  username: string;
}

/**
 * 获取 JWT 密钥
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET 环境变量未设置");
  }
  return secret;
}

/**
 * 签发 JWT Token
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_MAX_AGE });
}

/**
 * 验证并解析 JWT Token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 创建设置 auth Cookie 的 Response headers 选项
 */
export function createAuthCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  };
}

/**
 * 创建清除 auth Cookie 的选项
 */
export function createClearCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

/**
 * 从请求中提取并验证用户信息
 */
export async function getUserFromRequest(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}
