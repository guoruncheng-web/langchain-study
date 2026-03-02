"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  sessionCount: number;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 新增用户表单状态
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ username: "", email: "", password: "", role: "user" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || "加载用户列表失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadUsers();
  }, [user, loadUsers]);

  // 搜索防抖
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!search.trim()) {
        setFilteredUsers(users);
      } else {
        const keyword = search.toLowerCase();
        setFilteredUsers(
          users.filter(
            (u) =>
              u.username.toLowerCase().includes(keyword) ||
              u.email.toLowerCase().includes(keyword)
          )
        );
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, users]);

  // 修改角色
  const handleRoleChange = async (userId: string, newRole: string) => {
    setChangingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        await loadUsers();
      } else {
        setError(data.error || "修改角色失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setChangingId(null);
    }
  };

  // 切换用户状态（启用/禁用）
  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    setChangingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        await loadUsers();
      } else {
        setError(data.error || "操作失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setChangingId(null);
    }
  };

  // 新增用户
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateForm(false);
        setCreateForm({ username: "", email: "", password: "", role: "user" });
        await loadUsers();
      } else {
        setCreateError(data.error || "创建用户失败");
      }
    } catch {
      setCreateError("网络错误，请稍后重试");
    } finally {
      setCreating(false);
    }
  };

  // 错误自动消失
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 统计
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 错误提示 */}
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500 anim-card">
            {error}
          </div>
        )}

        {/* 统计卡片 */}
        <div className="flex gap-4">
          <div className="flex-1 rounded-xl border border-edge bg-surface p-4 shadow-sm anim-card">
            <p className="text-sm text-dim">总用户数</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {loadingData ? "-" : totalUsers}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-edge bg-surface p-4 shadow-sm anim-card" style={{ animationDelay: "0.05s" }}>
            <p className="text-sm text-dim">管理员数量</p>
            <p className="mt-1 text-2xl font-semibold text-accent">
              {loadingData ? "-" : adminCount}
            </p>
          </div>
        </div>

        {/* 搜索和新增 */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <svg className="h-4 w-4 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索用户名或邮箱..."
              className="input-glow w-full rounded-xl border border-edge bg-surface py-2.5 pl-10 pr-4 text-base sm:text-sm transition-all placeholder:text-faint"
            />
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新增用户
          </button>
        </div>

        {/* 新增用户表单 */}
        {showCreateForm && (
          <div className="rounded-xl border border-edge bg-surface p-6 shadow-sm anim-card">
            <h3 className="mb-4 text-sm font-semibold">创建新用户</h3>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dim">用户名</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="3-20位字母、数字或下划线"
                  className="input-glow w-full rounded-lg border border-edge bg-background px-3 py-2 text-base sm:text-sm transition-all placeholder:text-faint"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dim">邮箱</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="请输入邮箱"
                  className="input-glow w-full rounded-lg border border-edge bg-background px-3 py-2 text-base sm:text-sm transition-all placeholder:text-faint"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dim">密码</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="至少8位，包含字母和数字"
                  className="input-glow w-full rounded-lg border border-edge bg-background px-3 py-2 text-base sm:text-sm transition-all placeholder:text-faint"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dim">角色</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full rounded-lg border border-edge bg-background px-3 py-2 text-sm transition-all focus:border-accent focus:outline-none"
                  disabled={creating}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                {createError && (
                  <p className="flex-1 text-sm text-red-500">{createError}</p>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); setCreateError(null); }}
                    className="rounded-lg border border-edge px-4 py-2 text-sm text-dim transition-all hover:bg-elevated"
                    disabled={creating}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {creating ? "创建中..." : "创建"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* 用户表格 */}
        <div className="rounded-xl border border-edge bg-surface shadow-sm anim-card" style={{ animationDelay: "0.1s" }}>
          {loadingData ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <svg className="h-5 w-5 text-accent animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
                  </svg>
                </div>
                <p className="text-sm text-dim">加载中...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-faint">
                {search.trim() ? "未找到匹配的用户" : "暂无用户数据"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-edge">
                    <th className="px-4 py-3 font-medium text-dim">用户名</th>
                    <th className="px-4 py-3 font-medium text-dim">邮箱</th>
                    <th className="px-4 py-3 font-medium text-dim">角色</th>
                    <th className="px-4 py-3 font-medium text-dim">状态</th>
                    <th className="px-4 py-3 font-medium text-dim">会话数</th>
                    <th className="px-4 py-3 font-medium text-dim">注册时间</th>
                    <th className="px-4 py-3 font-medium text-dim">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-edge/50 last:border-b-0">
                      <td className="px-4 py-3 font-medium text-foreground">{u.username}</td>
                      <td className="px-4 py-3 text-dim">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          disabled={u.id === user?.id || changingId === u.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium transition-all focus:border-accent focus:outline-none ${
                            u.role === "admin"
                              ? "border-accent/30 bg-accent/10 text-accent"
                              : "border-edge bg-elevated text-dim"
                          } ${u.id === user?.id ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${changingId === u.id ? "opacity-50" : ""}`}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {u.status === "active" ? "正常" : "已禁用"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-dim">{u.sessionCount}</td>
                      <td className="px-4 py-3 text-dim whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-4 py-3">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleToggleStatus(u.id, u.status)}
                            disabled={changingId === u.id}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50 ${
                              u.status === "active"
                                ? "text-red-500 hover:bg-red-500/10"
                                : "text-emerald-500 hover:bg-emerald-500/10"
                            }`}
                          >
                            {changingId === u.id
                              ? "处理中..."
                              : u.status === "active"
                              ? "禁用"
                              : "启用"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
