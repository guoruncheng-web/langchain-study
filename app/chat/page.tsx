"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";

// 将文本中的链接解析为可点击的 <a> 标签
function renderContentWithLinks(content: string, isUser: boolean) {
  const urlRegex = /(https?:\/\/[^\s<>\"')\]]+)/g;
  const parts = content.split(urlRegex);
  if (parts.length === 1) return content;

  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 break-all ${
          isUser
            ? "text-blue-200 hover:text-white"
            : "text-accent hover:text-accent/80"
        }`}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

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

// const suggestions = [
//   "你能帮我做什么？",
//   "帮我写一封工作邮件",
//   "解释一下什么是人工智能",
//   "如何提高工作效率？",
// ];

export default function Chat() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quotaModal, setQuotaModal] = useState<{ tokenUsed: number; tokenLimit: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sessionActionLoading, setSessionActionLoading] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 复制消息内容
  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // 静默失败
    }
  };

  // 重命名会话
  const handleRename = async (sid: string) => {
    const trimmed = renameTitle.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    setSessionActionLoading(sid);
    try {
      const res = await fetch(`/api/chat/history/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        await loadSessions();
      }
    } catch {
      // 静默失败
    }
    setRenamingId(null);
    setSessionActionLoading(null);
  };

  // 删除会话
  const handleDelete = async (sid: string) => {
    setSessionActionLoading(sid);
    try {
      const res = await fetch(`/api/chat/history/${sid}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (sessionId === sid) {
          setSessionId(null);
          setMessages([]);
        }
        await loadSessions();
      }
    } catch {
      // 静默失败
    }
    setDeleteConfirmId(null);
    setSessionActionLoading(null);
  };

  // 开始重命名
  const startRename = (s: ChatSession) => {
    setRenamingId(s.id);
    setRenameTitle(s.title || "");
    setDeleteConfirmId(null);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

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
        if (response.status === 429) {
          const data = await response.json();
          setQuotaModal({ tokenUsed: data.tokenUsed, tokenLimit: data.tokenLimit });
          // 移除刚添加的用户消息
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
          return;
        }
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

  // const handleSuggestionClick = (text: string) => {
  //   setInput(text);
  // };

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
    <div className="flex h-screen overflow-hidden bg-background scifi-bg scanline">
      {/* 侧边栏遮罩（移动端） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-edge bg-surface transition-transform duration-300 ease-out lg:static lg:translate-x-0 scifi-sidebar ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
              className="flex w-full items-center gap-2 rounded-xl border border-edge px-3.5 py-2.5 text-sm font-medium transition-all hover:border-accent hover:bg-accent/5 btn-scifi"
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
              <div key={s.id} className="group/session relative mb-0.5">
                {sessionActionLoading === s.id ? (
                  <div className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-dim">
                    <svg className="h-4 w-4 shrink-0 animate-spin text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
                      <path d="M12 2v4" strokeLinecap="round" />
                    </svg>
                    <span className="truncate flex-1 opacity-60">{s.title || "新对话"}</span>
                  </div>
                ) : renamingId === s.id ? (
                  <div className="flex items-center gap-1.5 rounded-xl px-3 py-2">
                    <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <input
                      ref={renameInputRef}
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(s.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => handleRename(s.id)}
                      className="min-w-0 flex-1 rounded-md border border-accent/50 bg-background px-2 py-0.5 text-sm outline-none focus:border-accent"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => loadSession(s.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${sessionId === s.id
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-dim hover:bg-elevated hover:text-foreground"
                      }`}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <span className="truncate flex-1">{s.title || "新对话"}</span>
                    {/* 操作按钮 */}
                    <span className={`flex shrink-0 items-center gap-0.5 transition-opacity group-hover/session:opacity-100 ${sessionId === s.id ? "opacity-100" : "opacity-0"}`}>
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); startRename(s); }}
                        className="rounded-md p-1 text-faint hover:bg-accent/10 hover:text-accent"
                        title="重命名"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(s.id); }}
                        className="rounded-md p-1 text-faint hover:bg-red-500/10 hover:text-red-400"
                        title="删除"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </span>
                    </span>
                  </button>
                )}
              </div>
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
          className="flex items-center justify-between border-b border-edge px-4 py-2.5 scifi-header"
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
              <>
                <Link
                  href="/kb"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-dim transition-colors hover:bg-accent/5 hover:text-accent"
                >
                  知识库
                </Link>
                <Link
                  href="/admin"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-dim transition-colors hover:bg-accent/5 hover:text-accent"
                >
                  后台管理
                </Link>
              </>
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
        <div className="flex-1 overflow-y-auto chat-scroll grid-bg">
          <div className="relative z-10 mx-auto max-w-3xl space-y-5 px-4 py-6">
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
                  <div className="avatar-pulse mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-white">
                    ✦
                  </div>
                )}

                {/* 消息气泡 */}
                <div className={`max-w-[75%] ${message.role === "assistant" ? "group/msg" : ""}`}>
                  <div
                    className={`overflow-hidden rounded-2xl px-4 py-3 ${message.role === "user"
                      ? "bg-gradient-to-br from-[#6c5ce7] to-[#4834d4] text-white shadow-md dark:from-[#7c6ff7] dark:to-[#5a4fd8] scifi-bubble-user"
                      : "border border-edge bg-surface shadow-sm scifi-bubble-ai"
                      }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="markdown-body text-[0.938rem] leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-[0.938rem] leading-relaxed">
                        {renderContentWithLinks(message.content, true)}
                      </p>
                    )}
                  </div>
                  {/* 复制按钮 */}
                  {message.role === "assistant" && message.content && (
                    <button
                      onClick={() => handleCopy(message.id, message.content)}
                      className="copy-btn mt-1.5 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-faint opacity-0 transition-all hover:bg-elevated hover:text-dim group-hover/msg:opacity-100"
                    >
                      {copiedId === message.id ? (
                        <>
                          <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          <span className="text-green-400">已复制</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                          <span>复制</span>
                        </>
                      )}
                    </button>
                  )}
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
                <div className="avatar-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-white">
                  ✦
                </div>
                <div className="rounded-2xl border border-edge bg-surface px-4 py-3.5 shadow-sm scifi-bubble-ai">
                  <div className="flex items-center gap-1.5">
                    <div className="typing-dot typing-dot-scifi h-1.5 w-1.5 rounded-full"></div>
                    <div className="typing-dot typing-dot-scifi h-1.5 w-1.5 rounded-full"></div>
                    <div className="typing-dot typing-dot-scifi h-1.5 w-1.5 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区域 */}
        <div
          className="border-t border-edge px-4 py-3 scifi-input-area"
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

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="anim-card scifi-modal mx-4 w-full max-w-xs rounded-2xl border border-accent/30 bg-surface p-6 shadow-xl">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full mx-auto" style={{ background: 'rgba(239,68,68,0.08)', boxShadow: '0 0 20px rgba(239,68,68,0.15), inset 0 0 12px rgba(239,68,68,0.05)' }}>
              <svg className="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h3 className="mb-2 text-center text-base font-semibold">确认删除会话？</h3>
            <p className="mb-5 text-center text-sm text-dim">删除后将无法恢复该会话的所有消息记录。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={!!sessionActionLoading}
                className="flex-1 rounded-xl border border-edge py-2.5 text-sm font-medium text-dim transition-all hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={!!sessionActionLoading}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 15px rgba(239,68,68,0.3)' }}
              >
                {sessionActionLoading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
                      <path d="M12 2v4" strokeLinecap="round" />
                    </svg>
                    删除中...
                  </span>
                ) : "删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 额度用尽弹窗 */}
      {quotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="anim-card scifi-modal mx-4 w-full max-w-sm rounded-2xl border border-accent/30 bg-surface p-6 shadow-xl">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full mx-auto" style={{ background: 'rgba(239,68,68,0.08)', boxShadow: '0 0 20px rgba(239,68,68,0.15), inset 0 0 12px rgba(239,68,68,0.05)' }}>
              <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="mb-2 text-center text-lg font-semibold">今日 Token 用量已达上限</h3>
            <p className="mb-4 text-center text-sm text-dim">
              今日已使用 <span className="font-semibold text-accent">{quotaModal.tokenUsed.toLocaleString()}</span> / <span className="font-semibold text-accent">{quotaModal.tokenLimit.toLocaleString()}</span> tokens，明天将自动重置。如需更多额度请联系管理员。
            </p>
            <button
              onClick={() => setQuotaModal(null)}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
