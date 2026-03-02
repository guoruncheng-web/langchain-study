"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  // 前端校验
  const validate = (): string | null => {
    if (!username.trim()) return "请输入用户名";
    if (username.length < 3 || username.length > 20) return "用户名长度需要在 3-20 位之间";
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return "用户名只能包含字母、数字和下划线";
    if (!email.trim()) return "请输入邮箱";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不正确";
    if (!password) return "请输入密码";
    if (password.length < 8) return "密码长度不能少于 8 位";
    if (!/[a-zA-Z]/.test(password)) return "密码需要包含字母";
    if (!/[0-9]/.test(password)) return "密码需要包含数字";
    if (password !== confirmPassword) return "两次输入的密码不一致";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const err = await register(username.trim(), email.trim(), password);
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

  // 密码强度
  const getPasswordStrength = () => {
    if (!password) return null;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-zA-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 1) return { text: "弱", color: "text-red-400", barColor: "bg-red-400", width: "w-1/4" };
    if (strength <= 2) return { text: "中", color: "text-amber-400", barColor: "bg-amber-400", width: "w-2/4" };
    if (strength <= 3) return { text: "强", color: "text-emerald-400", barColor: "bg-emerald-400", width: "w-3/4" };
    return { text: "很强", color: "text-emerald-500", barColor: "bg-emerald-500", width: "w-full" };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      {/* 背景氛围光 */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/12 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/8 blur-[100px]" />

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
          创建新账户
        </h1>
        <p className="mb-8 text-center text-sm text-dim">
          注册后即可开始使用 AI 客服
        </p>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dim">
              用户名
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-20位字母、数字或下划线"
                className="input-glow w-full rounded-xl border border-edge bg-background py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-faint disabled:opacity-50"
                disabled={submitting}
              />
            </div>
          </div>

          {/* 邮箱 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dim">
              邮箱
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <svg className="h-4 w-4 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 6L2 7" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱地址"
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
                placeholder="至少8位，包含字母和数字"
                className="input-glow w-full rounded-xl border border-edge bg-background py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-faint disabled:opacity-50"
                disabled={submitting}
              />
            </div>
            {/* 密码强度条 */}
            {passwordStrength && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-edge">
                  <div className={`h-1 rounded-full transition-all duration-300 ${passwordStrength.barColor} ${passwordStrength.width}`} />
                </div>
                <span className={`text-xs ${passwordStrength.color}`}>
                  {passwordStrength.text}
                </span>
              </div>
            )}
          </div>

          {/* 确认密码 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dim">
              确认密码
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <svg className="h-4 w-4 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
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
            {submitting ? "注册中..." : "注 册"}
          </button>
        </form>

        {/* 登录链接 */}
        <p className="mt-6 text-center text-sm text-dim">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
