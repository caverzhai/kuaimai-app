FROM node:20-alpine

WORKDIR /app

# 安装wget
RUN apk add --no-cache wget

# 缓存破坏：每次构建都不同，强制docker重新执行后续步骤
ARG CACHEBUST=20260922093000
RUN echo "Cache bust: $CACHEBUST"

# 复制后端代码和共享代码
COPY server/ ./server/
COPY shared/ ./shared/

# 安装依赖并构建
WORKDIR /app/server
RUN npm install
RUN npm run build

# 从GitHub下载最新version.json和APK到dist/public
RUN echo "=== 从GitHub下载最新version.json和APK ===" && \
    wget -O dist/public/version.json "https://raw.githubusercontent.com/caverzhai/kuaimai-app/main/server/public/version.json" && \
    mkdir -p dist/public/download && \
    wget -O dist/public/download/kuaimai.apk "https://raw.githubusercontent.com/caverzhai/kuaimai-app/main/server/public/download/kuaimai.apk" && \
    ls -lh dist/public/download/kuaimai.apk && \
    cat dist/public/version.json

# 验证构建产物
RUN ls -la dist/server/main.js && echo "Build successful"

# 回到 app 目录
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/main.js"]
