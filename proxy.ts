import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie 名称（与 lib/auth.ts 保持一致）
const COOKIE_NAME = "auth-token";

// 需要认证的路由前缀
const PROTECTED_ROUTES = ["/", "/chat", "/api/chat", "/api/kb", "/kb"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  // 检查是否是受保护的路由（/ 仅精确匹配，其他前缀匹配）
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) =>
      route === "/"
        ? pathname === "/"
        : pathname === route || pathname.startsWith(route + "/")
  );

  // 未登录访问受保护路由
  if (isProtectedRoute && !token) {
    // API 路由返回 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401 }
      );
    }
    // 页面路由重定向到登录页
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// 配置 proxy 匹配的路由（仅保护需要认证的路由）
export const config = {
  matcher: [
    "/",
    "/chat/:path*",
    "/api/chat/:path*",
    "/api/kb/:path*",
    "/kb/:path*",
  ],
};
