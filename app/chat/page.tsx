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

const suggestions = [
  "你能帮我做什么？",
  "帮我写一封工作邮件",
  "解释一下什么是人工智能",
  "如何提高工作效率？",
];

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

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  // 加载中显示
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <svg className="h-5 w-5 text-accent animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
            </svg>
          </div>
          <p className="text-sm text-dim">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏遮罩（移动端） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-edge bg-surface transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-full flex-col">
          {/* 品牌区域 */}
          <div className="flex items-center gap-2.5 border-b border-edge px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight">AI Chat</span>
          </div>

          {/* 新建对话按钮 */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={newChat}
              className="flex w-full items-center gap-2 rounded-xl border border-edge px-3.5 py-2.5 text-sm font-medium transition-all hover:border-accent hover:bg-accent/5"
            >
              <svg className="h-4 w-4 text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建对话
            </button>
          </div>

          {/* 会话列表 */}
          <div className="flex-1 overflow-y-auto chat-scroll px-2 py-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${sessionId === s.id
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-dim hover:bg-elevated hover:text-foreground"
                  }`}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <span className="truncate">{s.title || "新对话"}</span>
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-faint">
                暂无聊天记录
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶部导航栏 */}
        <header
          className="flex items-center justify-between border-b border-edge px-4 py-2.5"
          style={{ background: 'var(--header-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-dim hover:bg-elevated lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base font-semibold tracking-tight">AI 客服</h1>
          </div>
          <div className="flex items-center gap-2.5">
            {user.role === 'admin' && (
              <Link
                href="/kb"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-dim transition-colors hover:bg-accent/5 hover:text-accent"
              >
                知识库
              </Link>
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
              {user.username?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="hidden text-sm text-dim sm:inline">{user.username}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-dim transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              退出
            </button>
          </div>
        </header>

        {/* 聊天区域 */}
        <div className="flex-1 overflow-y-auto chat-scroll">
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
            {/* 空状态 */}
            {messages.length === 0 && (
              <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <div className="anim-float mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                    <svg className="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                </div>
                <h2 className="mb-2 text-xl font-semibold">有什么可以帮你的？</h2>
                <p className="mb-8 text-sm text-dim">开始一段新的对话，向 AI 助手提问</p>
                {/* <div className="grid w-full max-w-md grid-cols-2 gap-2.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      className="rounded-xl border border-edge p-3.5 text-left text-sm text-dim transition-all hover:border-accent/50 hover:bg-accent/5 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div> */}
              </div>
            )}

            {/* 消息列表 */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`anim-msg flex items-start gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                {/* AI 头像 */}
                {message.role === "assistant" && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-white">
                    ✦
                  </div>
                )}

                {/* 消息气泡 */}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${message.role === "user"
                    ? "bg-gradient-to-br from-[#6c5ce7] to-[#4834d4] text-white shadow-md dark:from-[#7c6ff7] dark:to-[#5a4fd8]"
                    : "border border-edge bg-surface shadow-sm"
                    }`}
                >
                  <p className="whitespace-pre-wrap text-[0.938rem] leading-relaxed">
                    {message.content}
                  </p>
                </div>

                {/* 用户头像 */}
                {message.role === "user" && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {user?.username?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
            ))}

            {/* 加载动画 */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="anim-msg flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-white">
                  ✦
                </div>
                <div className="rounded-2xl border border-edge bg-surface px-4 py-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="typing-dot h-1.5 w-1.5 rounded-full bg-dim"></div>
                    <div className="typing-dot h-1.5 w-1.5 rounded-full bg-dim"></div>
                    <div className="typing-dot h-1.5 w-1.5 rounded-full bg-dim"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区域 */}
        <div
          className="border-t border-edge px-4 py-3"
          style={{ background: 'var(--input-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
        >
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="relative flex items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="发送消息..."
                className="input-glow w-full rounded-xl border border-edge bg-surface py-3 pl-4 pr-12 text-base sm:text-sm transition-all placeholder:text-faint disabled:opacity-50"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-25"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l7-7 7 7" />
                  <path d="M12 19V5" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
