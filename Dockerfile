FROM node:20-alpine

WORKDIR /app

# 缓存破坏：每次构建都不同，强制Docker重新复制文件
ARG CACHEBUST=20260921142500
RUN echo "Cache bust: $CACHEBUST"

# 复制后端代码和共享代码
COPY server/ ./server/
COPY shared/ ./shared/

# 验证APK文件是否存在（只打印，不报错）
RUN echo "=== APK文件 ===" && ls -la server/public/download/ && echo "APK大小: $(wc -c < server/public/download/kuaimai.apk) 字节"

# 验证version.json
RUN echo "=== version.json ===" && cat server/public/version.json

# 安装依赖并构建
WORKDIR /app/server
RUN npm install
RUN npm run build

# 手动复制public到dist（确保APK被复制）
RUN rm -rf dist/public && cp -r public dist/ && echo "public copied to dist" && ls -la dist/public/download/

# 验证构建产物
RUN ls -la dist/server/main.js && echo "Build successful"

# 回到 app 目录
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/main.js"]
