# 团队协作开发

当用户提出功能需求时，按以下流程执行团队协作开发。

## 输入

用户的功能需求描述：$ARGUMENTS

## 执行流程

### 第一步：创建团队

使用 TeamCreate 创建团队，team_name 根据需求自动命名（英文短横线格式）。

### 第二步：产品需求（product-manager）

1. 启动 product-manager agent（subagent_type: general-purpose）
2. 分析用户需求，调研相关代码和技术方案
3. 输出需求文档到 `docs/` 目录（中文 Markdown）
4. 需求文档包含：功能描述、交互细节、涉及文件、验收标准
5. 完成后关闭 agent

### 第三步：Lead 任务分解

1. 基于需求文档创建 TaskList
2. 拆分为具体开发任务，设定依赖关系
3. 任务依赖链：需求 → 后端(如需要) → 前端 → 测试

### 第四步：开发（backend-dev / frontend-dev）

根据任务类型启动对应 agent：

**后端开发（backend-dev）**：数据库 Schema、API 接口、权限控制

- 使用 subagent_type: general-purpose, mode: bypassPermissions
- 完成后通过 TypeScript 检查

**前端开发（frontend-dev）**：页面组件、对接 API、样式

- 使用 subagent_type: general-purpose, mode: bypassPermissions
- 遵循项目样式规范（SCSS Modules + antd-mobile + 赛博朋克暗色主题）
- 完成后通过 TypeScript 和 ESLint 检查
- 前端开发工程师可以调用 Playwright或者chrome-devtools-mcp来分析页面

可并行的任务同时启动，有依赖的串行执行。每个 agent 完成后及时关闭。

### 第五步：测试（tester）

1. 启动 tester agent（subagent_type: general-purpose, mode: bypassPermissions）
2. 执行检查：
   - `npx tsc --noEmit` — TypeScript 检查
   - `pnpm lint` — ESLint 检查
   - 代码审查 — 逐一验证功能逻辑
   - `pnpm build` — 构建验证
3. 发现问题直接修复
4. 输出测试报告
5. 完成后关闭 agent

### 第六步(reviewer)

1. 启动 review agent
2. 检查开发的代码有没有漏洞,安全性问题,或者有没有其他优化的空间
3. 使用 react-best-practies review 一下 开发的代码有没有规范或者可以优化的空间
4. review 完成后分任务给出意见修改

### 第七步：完成

1. 确认所有任务 completed
2. 关闭所有 agent，TeamDelete 清理资源
3. 向用户汇报变更摘要

## 重要规范

- 所有 agent 使用 run_in_background: true 后台运行
- 空闲 agent 及时 shutdown_request 关闭
- 代码使用中文注释
- 先读现有代码了解风格再开发
- 每个功能单独分支开发（如用户要求）
