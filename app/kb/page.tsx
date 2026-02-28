"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";

// 文档类型定义
interface KBDocument {
  id: string;
  filename: string;
  fileSize: number;
  chunkCount: number;
  status: "processing" | "ready" | "error";
  createdAt: string;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// 状态标签颜色
function statusStyle(status: string): string {
  switch (status) {
    case "ready":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "processing":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
    case "error":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

// 状态中文
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

export default function KnowledgeBase() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 未登录重定向
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // 非管理员重定向到聊天页面
  useEffect(() => {
    if (!loading && user && user.role !== 'admin') {
      router.push("/chat");
    }
  }, [user, loading, router]);

  // 加载文档列表
  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/kb");
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, loadDocuments]);

  // 登出
  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // 上传文件
  const uploadFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    // 前端校验文件类型
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "md") {
      setUploadError("仅支持 .txt 和 .md 格式的文件");
      return;
    }

    // 前端校验文件大小
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("文件大小不能超过 2MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/kb/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadSuccess(`文件 "${data.document.filename}" 上传成功，已分为 ${data.document.chunkCount} 个块`);
        loadDocuments();
      } else {
        setUploadError(data.error || "上传失败");
      }
    } catch {
      setUploadError("上传失败，请检查网络连接");
    } finally {
      setUploading(false);
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // 重置 input 以便重复选择同一文件
    e.target.value = "";
  };

  // 拖拽事件处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  // 删除文档
  const handleDelete = async (doc: KBDocument) => {
    if (!confirm(`确定要删除文档 "${doc.filename}" 吗？此操作不可撤销。`)) {
      return;
    }

    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/kb/${doc.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        loadDocuments();
      } else {
        alert(data.error || "删除失败");
      }
    } catch {
      alert("删除失败，请检查网络连接");
    } finally {
      setDeletingId(null);
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
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            知识库管理
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="rounded-lg px-3 py-1 text-sm text-blue-500 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-gray-700"
          >
            返回聊天
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

      {/* 主内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* 文件上传区域 */}
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
              上传文档
            </h2>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
              } ${uploading ? "pointer-events-none opacity-50" : ""}`}
            >
              <input
                type="file"
                accept=".txt,.md"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={uploading}
              />
              {/* 上传图标 */}
              <svg
                className="mb-3 h-10 w-10 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
                />
              </svg>
              {uploading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  正在上传...
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    拖拽文件到此处，或
                    <span className="text-blue-500"> 点击选择文件</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    支持 .txt、.md 格式，最大 2MB
                  </p>
                </>
              )}
            </div>

            {/* 上传结果提示 */}
            {uploadError && (
              <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
                {uploadSuccess}
              </div>
            )}
          </div>

          {/* 文档列表 */}
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
              文档列表
            </h2>

            {documents.length === 0 ? (
              <div className="py-12 text-center text-gray-400 dark:text-gray-500">
                暂无文档，请上传文件
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="pb-3 pr-4 font-medium">文件名</th>
                      <th className="pb-3 pr-4 font-medium">大小</th>
                      <th className="pb-3 pr-4 font-medium">分块数</th>
                      <th className="pb-3 pr-4 font-medium">状态</th>
                      <th className="pb-3 pr-4 font-medium">上传时间</th>
                      <th className="pb-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-gray-100 dark:border-gray-700/50"
                      >
                        <td className="py-3 pr-4 text-gray-900 dark:text-white">
                          {doc.filename}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                          {formatFileSize(doc.fileSize)}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                          {doc.chunkCount}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(doc.status)}`}
                          >
                            {statusLabel(doc.status)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                          {new Date(doc.createdAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.id}
                            className="rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            {deletingId === doc.id ? "删除中..." : "删除"}
                          </button>
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
    </div>
  );
}
