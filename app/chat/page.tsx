"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

export default function Chat() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 未登录重定向
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/history");
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user, loadSessions]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 加载指定会话的消息
  const loadSession = async (sid: string) => {
    try {
      const res = await fetch(`/api/chat/history/${sid}`);
      const data = await res.json();
      if (data.success) {
        setSessionId(sid);
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
        setSidebarOpen(false);
      }
    } catch {
      // 静默失败
    }
  };

  // 新建对话
  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  // 登出
  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // 发送消息
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("请求失败");
      }

      // 从响应头获取 sessionId
      const newSessionId = response.headers.get("X-Session-Id");
      if (newSessionId && !sessionId) {
        setSessionId(newSessionId);
        // 刷新会话列表
        loadSessions();
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("无法读取响应");
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage.content += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      }

      // 流式结束后刷新会话列表
      loadSessions();
    } catch (error) {
      console.error("错误:", error);
      alert("发送消息失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 加载中显示
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* 侧边栏遮罩（移动端） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-lg transition-transform duration-200 dark:bg-gray-800 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* 新建对话按钮 */}
          <div className="p-4">
            <button
              onClick={newChat}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              + 新建对话
            </button>
          </div>

          {/* 会话列表 */}
          <div className="flex-1 overflow-y-auto px-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`mb-1 w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  sessionId === s.id
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {s.title || "新对话"}
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="px-3 py-2 text-center text-xs text-gray-400">
                暂无聊天记录
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex flex-1 flex-col">
        {/* 顶部导航栏 */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            {/* 汉堡菜单（移动端） */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              AI 客服聊天系统
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/kb"
              className="rounded-lg px-3 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
            >
              知识库
            </Link>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
            >
              退出
            </button>
          </div>
        </header>

        {/* 聊天区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && (
              <div className="mt-8 text-center text-gray-400">
                开始对话，向 AI 提问...
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  }`}
                >
                  <div className="mb-1 text-sm font-semibold">
                    {message.role === "user" ? "你" : "AI"}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-800">
                  <div className="mb-1 text-sm font-semibold dark:text-gray-100">AI</div>
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-100"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-200"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-blue-500 px-6 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              发送
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}