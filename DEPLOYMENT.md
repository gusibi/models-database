# Cloudflare Pages 部署指南

## 在 Cloudflare Pages 上部署

### 1. 推送代码到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. 在 Cloudflare Pages 中创建项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** > **Create application** > **Pages**
3. 选择 **Connect to Git**
4. 选择你的 GitHub 仓库并授权
5. 配置构建设置：

| 配置项 | 值 |
|--------|-----|
| **Project name** | `models-page`（或自定义名称）|
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | `npm run build` |
| **Build output directory** | `.svelte-kit/cloudflare` |

6. 点击 **Save and Deploy**

### 3. 环境变量（可选）

如果需要，在 **Settings** > **Environment variables** 中添加：
- Production
- Preview
- Deployment

## 构建说明

项目使用 `@sveltejs/adapter-cloudflare` 适配器，它会：

1. 将静态资源生成到 `.svelte-kit/output/client`
2. 将服务器代码编译为 Cloudflare Pages Function
3. 自动复制 worker 文件到输出目录

构建命令会自动处理：
- ✅ 复制 `_worker.js`（Cloudflare Pages Function）
- ✅ 复制 `_headers`（HTTP 头配置）
- ✅ 复制 `_routes.json`（路由配置）
- ✅ 复制 `sitemap.xml`（站点地图）
- ✅ 复制 `models.json`（模型数据）
- ✅ 复制 `robots.txt`（爬虫配置）

## 验证部署

部署成功后，访问：
- `https://your-project.pages.dev` - 主页（自动重定向到 `/en`）
- `https://your-project.pages.dev/zh` - 中文页面
- `https://your-project.pages.dev/ja` - 日语页面
- 其他语言路由...

## 故障排除

### 构建失败

- 检查 Node.js 版本（推荐 18 或更高）
- 确认 `@sveltejs/adapter-cloudflare` 已安装
- 查看构建日志中的错误信息

### 页面无法访问

- 检查 Cloudflare Pages 的构建是否成功
- 查看 Pages 的 **Functions** 标签页确认 Function 已部署
- 检查路由配置

### 多语言路由问题

- 确认 `+layout.ts` 正确返回 `lang` 参数
- 检查 `getLangFromPath` 函数在 `i18n.ts` 中正确实现

### Worker 函数错误

- 检查 `_worker.js` 是否在输出目录根目录
- 查看 Pages 的 **Functions** 日志

## 本地预览

构建后在本地预览：

```bash
npm run build
npx wrangler pages dev .svelte-kit/cloudflare
```

## 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages Functions 文档](https://developers.cloudflare.com/pages/functions/)
- [SvelteKit 适配器文档](https://kit.svelte.dev/docs/adapters)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
