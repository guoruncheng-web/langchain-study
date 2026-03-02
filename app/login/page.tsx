"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!loginId.trim() || !password) {
      setError("请输入用户名/邮箱和密码");
      return;
    }

    setSubmitting(true);
    try {
      const err = await login(loginId.trim(), password);
      if (err) {
        setError(err);
      } else {
        router.push("/chat");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* 背景氛围光 */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/12 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/8 blur-[100px]" />

      {/* 卡片 */}
      <div className="anim-card relative z-10 w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-xl">
        {/* 品牌图标 */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
            </svg>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">
          AI 客服系统
        </h1>
        <p className="mb-8 text-center text-sm text-dim">
          登录您的账户以继续
        </p>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名/邮箱 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dim">
              用户名 / 邮箱
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <svg className="h-4 w-4 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="请输入用户名或邮箱"
                className="input-glow w-full rounded-xl border border-edge bg-background py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-faint disabled:opacity-50"
                disabled={submitting}
              />
            </div>
          </div>

          {/* 密码 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dim">
              密码
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <svg className="h-4 w-4 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="input-glow w-full rounded-xl border border-edge bg-background py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-faint disabled:opacity-50"
                disabled={submitting}
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-[#6c5ce7] to-[#4834d4] py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 dark:from-[#7c6ff7] dark:to-[#5a4fd8]"
          >
            {submitting ? "登录中..." : "登 录"}
          </button>
        </form>

        {/* 注册链接 暂时未开放 */}
        {/* <p className="mt-6 text-center text-sm text-dim">
          还没有账号？{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            去注册
          </Link>
        </p> */}
      </div>
    </div>
  );
}
