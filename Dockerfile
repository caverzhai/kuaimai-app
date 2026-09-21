FROM node:20-alpine

WORKDIR /app

# 安装wget（用于从GitHub下载最新version.json）
RUN apk add --no-cache wget

# 缓存破坏：每次构建都不同，强制Docker重新执行后续步骤
ARG CACHEBUST=20260921160000
RUN echo "Cache bust: $CACHEBUST"

# 复制后端代码和共享代码
COPY server/ ./server/
COPY shared/ ./shared/

# 从GitHub下载最新version.json（APK太大，跳过下载）
RUN echo "=== 从GitHub下载最新version.json ===" && \
    wget -O server/public/version.json "https://raw.githubusercontent.com/caverzhai/kuaimai-app/main/server/public/version.json" && \
    cat server/public/version.json

# 安装依赖并构建
WORKDIR /app/server
RUN npm install
RUN npm run build

# 手动复制public到dist（确保APK被复制）
RUN rm -rf dist/public && cp -r public dist/ && echo "public copied to dist"

# 验证构建产物
RUN ls -la dist/server/main.js && echo "Build successful"

# 回到 app 目录
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/main.js"]
