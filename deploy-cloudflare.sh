#!/bin/bash

# Cloudflare Pages 部署脚本

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}开始部署到 Cloudflare Pages...${NC}"

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}安装依赖...${NC}"
    npm install
fi

# 构建项目
echo -e "${YELLOW}构建项目...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

# 部署到 Cloudflare Pages
echo -e "${YELLOW}部署到 Cloudflare Pages...${NC}"
npx wrangler pages deploy .svelte-kit/output/client --project-name=models-page

if [ $? -eq 0 ]; then
    echo -e "${GREEN}部署成功！${NC}"
else
    echo -e "${RED}部署失败！${NC}"
    exit 1
fi
