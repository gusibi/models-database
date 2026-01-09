# Cloudflare Pages 部署指南

## 方式一：通过 Git 集成部署（推荐）

### 1. 推送代码到 GitHub

```bash
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. 在 Cloudflare Pages 中创建项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** > **Create application**
3. 选择 **Connect to Git**
4. 选择你的 GitHub 仓库
5. 配置构建设置：
   - **构建命令**: `npm run build`
   - **输出目录**: `.svelte-kit/output/client`
6. 点击 **Save and Deploy**

### 3. 环境变量（如需要）

在 **Settings** > **Environment variables** 中添加任何需要的环境变量。

## 方式二：通过 Wrangler CLI 部署

### 1. 登录 Cloudflare

```bash
npx wrangler login
```

### 2. 使用部署脚本

```bash
chmod +x deploy-cloudflare.sh
./deploy-cloudflare.sh
```

或者手动部署：

```bash
npm run build
npx wrangler pages deploy .svelte-kit/output/client --project-name=models-page
```

### 3. 创建 Pages 项目（首次部署时）

如果需要手动创建项目：

```bash
npx wrangler pages project create models-page
```

## 注意事项

1. **构建输出**: `adapter-cloudflare` 会将静态文件输出到 `.svelte-kit/output/client`，服务器代码输出到 `.svelte-kit/output/server`

2. **路由**: Cloudflare Pages 会自动处理 SvelteKit 的路由

3. **边缘函数**: `adapter-cloudflare` 会自动为 Cloudflare Pages Functions 生成必要的函数代码

4. **缓存**: `_headers` 文件已配置正确的缓存策略

## 故障排除

### 部署失败

如果看到 "Missing entry-point" 错误，确保：
- 构建命令是 `npm run build`
- 输出目录是 `.svelte-kit/output/client`
- 使用了 `@sveltejs/adapter-cloudflare`

### 页面无法访问

检查 Cloudflare Pages 的日志和构建设置。

### 多语言路由

确保 SvelteKit 的路由配置正确，语言路由应该正常工作。

## 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [SvelteKit 适配器文档](https://kit.svelte.dev/docs/adapters)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
