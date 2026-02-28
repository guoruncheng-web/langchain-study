/**
 * 创建测试账号脚本
 * 使用方式: npx tsx scripts/create-test-user.ts
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("请设置 DATABASE_URL 环境变量");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  // 确保 role 列存在
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`;

  // 测试账号信息
  const username = "test";
  const email = "test@test.com";
  const password = "test123456";
  const role = "user";

  // 检查是否已存在
  const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length > 0) {
    console.log(`用户 "${username}" 已存在，跳过创建`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();

  await sql`
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES (${userId}, ${username}, ${email}, ${passwordHash}, ${role})
  `;

  console.log(`测试账号创建成功: username=${username}, password=${password}, role=${role}`);
}

main().catch((err) => {
  console.error("创建失败:", err);
  process.exit(1);
});
