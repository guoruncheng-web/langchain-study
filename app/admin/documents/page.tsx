"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface AdminDocument {
  id: string;
  filename: string;
  fileSize: number;
  chunkCount: number;
  status: "processing" | "ready" | "error";
  createdAt: string;
  username: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function statusStyle(status: string): string {
  switch (status) {
    case "ready":
      return "bg-emerald-500/10 text-emerald-500";
    case "processing":
      return "bg-amber-500/10 text-amber-500";
    case "error":
      return "bg-red-500/10 text-red-500";
    default:
      return "bg-elevated text-dim";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "就绪";
    case "processing":
      return "处理中";
    case "error":
      return "错误";
    default:
      return status;
  }
}

export default function AdminDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);
      const res = await fetch("/api/admin/documents");
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
      } else {
        setError(data.error || "加载文档列表失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, loadDocuments]);

  // 错误自动消失
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 统计
  const totalDocs = documents.length;
  const readyCount = documents.filter((d) => d.status === "ready").length;
  const processingCount = documents.filter((d) => d.status === "processing").length;

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
            <p className="text-sm text-dim">总文档数</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {loadingData ? "-" : totalDocs}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-edge bg-surface p-4 shadow-sm anim-card" style={{ animationDelay: "0.05s" }}>
            <p className="text-sm text-dim">就绪文档</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-500">
              {loadingData ? "-" : readyCount}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-edge bg-surface p-4 shadow-sm anim-card" style={{ animationDelay: "0.1s" }}>
            <p className="text-sm text-dim">处理中</p>
            <p className="mt-1 text-2xl font-semibold text-amber-500">
              {loadingData ? "-" : processingCount}
            </p>
          </div>
        </div>

        {/* 文档表格 */}
        <div className="rounded-xl border border-edge bg-surface shadow-sm anim-card" style={{ animationDelay: "0.15s" }}>
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
          ) : documents.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-faint">暂无知识库文档</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-edge">
                    <th className="px-4 py-3 font-medium text-dim">文件名</th>
                    <th className="px-4 py-3 font-medium text-dim">上传者</th>
                    <th className="px-4 py-3 font-medium text-dim">大小</th>
                    <th className="px-4 py-3 font-medium text-dim">分块数</th>
                    <th className="px-4 py-3 font-medium text-dim">状态</th>
                    <th className="px-4 py-3 font-medium text-dim">上传时间</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-edge/50 last:border-b-0">
                      <td className="px-4 py-3 font-medium text-foreground">{doc.filename}</td>
                      <td className="px-4 py-3 text-dim">{doc.username}</td>
                      <td className="px-4 py-3 text-dim whitespace-nowrap">{formatFileSize(doc.fileSize)}</td>
                      <td className="px-4 py-3 text-dim">{doc.chunkCount}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(doc.status)}`}
                        >
                          {statusLabel(doc.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-dim whitespace-nowrap">
                        {new Date(doc.createdAt).toLocaleString("zh-CN")}
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
