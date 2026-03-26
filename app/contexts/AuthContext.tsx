"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const TOKEN_STORAGE_KEY = "auth_token";

// 用户类型
interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  tokenLimit?: number;
  tokenUsed?: number;
}

// 认证上下文类型
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<string | null>;
  register: (username: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 带认证的 fetch，自动附加 Authorization header
 */
function createAuthFetch() {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    }
    return fetch(input, init);
  };
}

// 认证上下文提供者
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authFetch] = useState(() => createAuthFetch());

  // 页面加载时检查登录状态
  useEffect(() => {
    // 检查 URL 中是否有 SSO token（iframe 跨域登录）
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    if (ssoToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, ssoToken);
      // 清除 URL 中的 token 参数
      params.delete("sso_token");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }

    // 用 authFetch 检查登录状态
    authFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.user);
        } else {
          // token 无效，清除
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  // 登录方法，返回 null 表示成功，返回错误信息表示失败
  const login = useCallback(async (loginId: string, password: string): Promise<string | null> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    });
    const data = await res.json();
    if (data.success) {
      // 同时存到 localStorage（兼容 iframe 场景）
      if (data.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
      setUser(data.user);
      return null;
    }
    return data.error || "登录失败";
  }, []);

  // 注册方法
  const register = useCallback(async (username: string, email: string, password: string): Promise<string | null> => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (data.success) {
      if (data.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
      setUser(data.user);
      return null;
    }
    return data.error || "注册失败";
  }, []);

  // 登出方法
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

// 认证 Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return context;
}
