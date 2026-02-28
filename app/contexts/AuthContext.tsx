"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// 用户类型
interface User {
  id: string;
  username: string;
  email: string;
}

// 认证上下文类型
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<string | null>;
  register: (username: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证上下文提供者
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 页面加载时检查登录状态
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 登录方法，返回 null 表示成功，返回错误信息表示失败
  const login = useCallback(async (loginId: string, password: string): Promise<string | null> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    });
    const data = await res.json();
    if (data.success) {
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
      setUser(data.user);
      return null;
    }
    return data.error || "注册失败";
  }, []);

  // 登出方法
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
