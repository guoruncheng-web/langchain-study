# 项目功能截图

对博客项目的线上页面进行全页面长截图，保存到 `docs/screenshots/` 目录。

## 输入

可选参数：$ARGUMENTS

- 不传参数：截取所有 12 个页面
- 传入页面名称：只截取指定页面（如 `home`、`login`、`admin-dashboard`）
- 传入线上地址：使用指定地址替代默认地址

默认线上地址：`https://www.blog.xingzdh.com`

## 执行流程

### 第一步：运行截图脚本

使用 `npx tsx scripts/take-screenshots.ts` 执行截图。

脚本会：
1. 启动 Playwright headless Chromium（视口 1280x800）
2. 前台页面（无需登录）：首页、文章详情、归档页、标签云、关于页、登录页
3. 后台页面（自动登录 admin 账户）：仪表盘、文章管理、新建文章、分类管理、标签管理、用户管理
4. 每个页面滚动触发懒加载，等待所有图片加载完成后截取全页面长图
5. 截图保存到 `docs/screenshots/` 目录

如果用户只需要截取部分页面，修改脚本中的页面配置数组后再执行。

如果用户提供了不同的线上地址，修改脚本中的 `BASE_URL` 后再执行。

### 第二步：验证截图

1. 检查 `docs/screenshots/` 目录下的文件数量和大小
2. 读取关键截图（如首页）确认图片内容正常、封面图加载完整
3. 如有问题（如图片未加载），增加等待时间后重试

### 第三步：更新文档（可选）

如果截图有变化且用户要求更新文档：
- 更新 `docs/project-introduction.md` 中的截图引用
- 更新 `README.md` 中的截图引用

## 截图页面清单

| 编号 | 文件名 | URL | 说明 |
|------|--------|-----|------|
| 01 | 01-home.png | `/` | 首页 |
| 02 | 02-post-detail.png | `/posts/hello-world` | 文章详情 |
| 03 | 03-archives.png | `/archives` | 归档页 |
| 04 | 04-tags.png | `/tags` | 标签云 |
| 05 | 05-about.png | `/about` | 关于页 |
| 06 | 06-login.png | `/login` | 登录页 |
| 07 | 07-admin-dashboard.png | `/admin` | 管理仪表盘 |
| 08 | 08-admin-posts.png | `/admin/posts` | 文章管理 |
| 09 | 09-admin-post-new.png | `/admin/posts/new` | 新建文章 |
| 10 | 10-admin-categories.png | `/admin/categories` | 分类管理 |
| 11 | 11-admin-tags.png | `/admin/tags` | 标签管理 |
| 12 | 12-admin-users.png | `/admin/users` | 用户管理 |

## 依赖

- `@playwright/test`（已安装）
- Playwright Chromium 浏览器（通过 `npx playwright install chromium` 安装）
- 截图脚本：`scripts/take-screenshots.ts`
