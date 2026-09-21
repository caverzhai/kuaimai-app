FROM node:20-alpine

WORKDIR /app

# 缓存破坏：每次构建都不同，强制docker重新执行后续步骤
ARG CACHEBUST=20260922061000
RUN echo "Cache bust: $CACHEBUST"

# 复制后端代码和共享代码（包含本地构建的前端dist和APK）
COPY server/ ./server/
COPY shared/ ./shared/

# 安装依赖并构建
WORKDIR /app/server
RUN npm install
RUN npm run build

# 使用本地构建的前端资源和APK（不从GitHub下载）
RUN rm -rf dist/public && cp -r public dist/ && \
    echo "Local APK size: $(wc -c < dist/public/download/kuaimai.apk) bytes" && \
    cat dist/public/version.json

# 验证构建产物
RUN ls -la dist/server/main.js && echo "Build successful"

# 回到 app 目录
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/main.js"]
