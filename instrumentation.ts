import { initTables } from "@/lib/db";

// Next.js 服务器启动时自动调用，用于初始化数据库表结构
export async function register() {
  try {
    await initTables();
    console.log("数据库表初始化完成");
  } catch (error) {
    console.error("数据库表初始化失败:", error);
  }
}
