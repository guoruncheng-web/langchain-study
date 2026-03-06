"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface DailyCount {
  date: string;
  count: number;
}

interface DailyToken {
  date: string;
  tokens: number;
}

interface Stats {
  totalUsers: number;
  totalSessions: number;
  totalMessages: number;
  dailyUsers: DailyCount[];
  dailyMessages: DailyCount[];
  dailyTokenUsage: DailyToken[];
}

// 简易 SVG 折线图
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LineChart({ data, valueKey, color, label }: { data: { date: string; [k: string]: any }[]; valueKey: string; color: string; label: string }) {
  if (data.length === 0) return <p className="py-12 text-center text-sm text-faint">暂无数据</p>;

  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const w = 600;
  const h = 200;
  const padX = 40;
  const padY = 24;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const points = values.map((v, i) => {
    const x = padX + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const y = padY + chartH - (v / max) * chartH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padX + (data.length === 1 ? chartW / 2 : 0)},${padY + chartH}`,
    ...points,
    `${padX + (data.length === 1 ? chartW / 2 : chartW)},${padY + chartH}`,
  ].join(" ");

  // Y 轴刻度
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: padY + chartH - r * chartH,
    label: Math.round(r * max).toLocaleString(),
  }));

  // X 轴标签（最多显示 6 个）
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-5 shadow-sm anim-card">
      <h3 className="mb-4 text-sm font-semibold" style={{ color }}>{label}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* 网格线 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padX} y1={t.y} x2={w - padX} y2={t.y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 2" />
            <text x={padX - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="var(--text-faint)">{t.label}</text>
          </g>
        ))}
        {/* 面积填充 */}
        <polygon points={areaPoints} fill={color} opacity="0.1" />
        {/* 折线 */}
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* 发光效果 */}
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" opacity="0.2" />
        {/* 数据点 */}
        {points.map((p, i) => {
          const [cx, cy] = p.split(",").map(Number);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="4" fill={color} opacity="0.3" />
              <circle cx={cx} cy={cy} r="2.5" fill={color} />
            </g>
          );
        })}
        {/* X 轴标签 */}
        {xLabels.map((d) => {
          const idx = data.indexOf(d);
          const x = padX + (data.length === 1 ? chartW / 2 : (idx / (data.length - 1)) * chartW);
          const dateStr = new Date(d.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
          return (
            <text key={d.date} x={x} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--text-faint)">{dateStr}</text>
          );
        })}
      </svg>
    </div>
  );
}

// 简易 SVG 柱状图
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarChart({ data, valueKey, color, label }: { data: { date: string; [k: string]: any }[]; valueKey: string; color: string; label: string }) {
  if (data.length === 0) return <p className="py-12 text-center text-sm text-faint">暂无数据</p>;

  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const w = 600;
  const h = 200;
  const padX = 40;
  const padY = 24;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;
  const barGap = 2;
  const barW = Math.max(4, (chartW - barGap * data.length) / data.length);

  // Y 轴刻度
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: padY + chartH - r * chartH,
    label: Math.round(r * max).toLocaleString(),
  }));

  // X 轴标签
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-5 shadow-sm anim-card">
      <h3 className="mb-4 text-sm font-semibold" style={{ color }}>{label}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* 网格线 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padX} y1={t.y} x2={w - padX} y2={t.y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 2" />
            <text x={padX - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="var(--text-faint)">{t.label}</text>
          </g>
        ))}
        {/* 柱状条 */}
        {values.map((v, i) => {
          const barH = (v / max) * chartH;
          const x = padX + i * (barW + barGap) + barGap / 2;
          const y = padY + chartH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="2" fill={color} opacity="0.7" />
              <rect x={x} y={y} width={barW} height={Math.min(barH, 4)} rx="2" fill={color} opacity="1" />
            </g>
          );
        })}
        {/* X 轴标签 */}
        {xLabels.map((d) => {
          const idx = data.indexOf(d);
          const x = padX + idx * (barW + barGap) + barGap / 2 + barW / 2;
          const dateStr = new Date(d.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
          return (
            <text key={d.date} x={x} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--text-faint)">{dateStr}</text>
          );
        })}
      </svg>
    </div>
  );
}

export default function AdminStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || "加载统计数据失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadStats();
  }, [user, loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <svg className="h-5 w-5 text-accent animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
            </svg>
          </div>
          <p className="text-sm text-dim">加载统计数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500 anim-card">{error}</div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const summaryCards = [
    { label: "总用户数", value: stats.totalUsers, icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", extra: "M9 7a4 4 0 100-8 4 4 0 000 8z" },
    { label: "总会话数", value: stats.totalSessions, icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
    { label: "总消息数", value: stats.totalMessages, icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {summaryCards.map((card, i) => (
            <div
              key={card.label}
              className="rounded-xl border border-edge bg-surface p-5 shadow-sm anim-card"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={card.icon} />
                  {card.extra && <path d={card.extra} />}
                </svg>
              </div>
              <p className="text-sm text-dim">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* 图表 */}
        <LineChart
          data={stats.dailyUsers}
          valueKey="count"
          color="var(--accent)"
          label="用户增长趋势（近 30 天）"
        />

        <BarChart
          data={stats.dailyMessages}
          valueKey="count"
          color="#22c55e"
          label="每日消息量（近 30 天）"
        />

        <LineChart
          data={stats.dailyTokenUsage}
          valueKey="tokens"
          color="#f59e0b"
          label="Token 消耗趋势（近 30 天）"
        />
      </div>
    </div>
  );
}
