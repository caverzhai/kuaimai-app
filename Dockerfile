FROM node:20-alpine

WORKDIR /app

# 缓存破坏：每次构建都不同，强制Docker重新复制文件
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"

# 复制后端代码和共享代码
COPY server/ ./server/
COPY shared/ ./shared/

# 立即验证APK文件大小（确保复制的是最新版本）
RUN echo "=== APK验证 ===" && ls -la server/public/download/ && APK_SIZE=$(wc -c < server/public/download/kuaimai.apk) && echo "APK大小: $APK_SIZE 字节" && if [ "$APK_SIZE" -lt 9159900 ]; then echo "错误：APK不是最新版本！" && exit 1; fi

# 验证version.json（强制刷新缓存）
RUN echo "=== version.json 内容 ===" && cat server/public/version.json && echo "=== version.json 结束 ==="
RUN echo "构建时间: $(date)"
RUN echo "强制重新构建标记: 20260921135200"

# 安装依赖并构建
WORKDIR /app/server
RUN npm install
RUN npm run build

# 验证构建产物和APK
RUN ls -la dist/server/main.js && echo "Build successful"
RUN ls -la public/download/ 2>/dev/null || echo "public/download不存在"

# 回到 app 目录
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/main.js"]
