import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { NextResponse } from "next/server";

// 管理员权限校验
async function checkAdmin() {
  const payload = await getUserFromRequest();
  if (!payload) {
    return { error: NextResponse.json({ success: false, error: "未登录" }, { status: 401 }) };
  }
  if (payload.role !== "admin") {
    return { error: NextResponse.json({ success: false, error: "无权访问" }, { status: 403 }) };
  }
  return { payload };
}

// 获取管理后台统计数据
export async function GET() {
  const { error } = await checkAdmin();
  if (error) return error;

  const sql = getSQL();

  // 并行查询所有统计数据
  const [
    totalUsersResult,
    totalSessionsResult,
    totalMessagesResult,
    dailyUsersResult,
    dailyMessagesResult,
    dailyTokenUsageResult,
  ] = await Promise.all([
    // 总用户数
    sql`SELECT COUNT(*)::int AS count FROM users`,
    // 总会话数
    sql`SELECT COUNT(*)::int AS count FROM chat_sessions`,
    // 总消息数
    sql`SELECT COUNT(*)::int AS count FROM messages`,
    // 近30天每日新增用户
    sql`
      SELECT DATE(created_at) AS date, COUNT(*)::int AS count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
    // 近30天每日消息数
    sql`
      SELECT DATE(created_at) AS date, COUNT(*)::int AS count
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
    // 近30天每日 token 用量（按消息内容长度 * 1.5 估算）
    sql`
      SELECT DATE(created_at) AS date,
             ROUND(SUM(LENGTH(content) * 1.5))::int AS tokens
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
  ]);

  return NextResponse.json({
    success: true,
    stats: {
      totalUsers: totalUsersResult[0].count,
      totalSessions: totalSessionsResult[0].count,
      totalMessages: totalMessagesResult[0].count,
      dailyUsers: dailyUsersResult.map((r) => ({
        date: r.date,
        count: r.count,
      })),
      dailyMessages: dailyMessagesResult.map((r) => ({
        date: r.date,
        count: r.count,
      })),
      dailyTokenUsage: dailyTokenUsageResult.map((r) => ({
        date: r.date,
        tokens: r.tokens,
      })),
    },
  });
}
