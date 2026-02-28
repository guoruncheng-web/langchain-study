import { NextResponse } from "next/server";
import { createClearCookieOptions } from "@/lib/auth";

// 用户登出 API
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(createClearCookieOptions());
  return response;
}
