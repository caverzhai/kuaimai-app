FROM node:20-alpine

WORKDIR /app

# 复制后端代码和共享代码
COPY server/ ./server/
COPY shared/ ./shared/

# 验证APK文件是否存在
RUN ls -la server/public/download/ 2>/dev/null || echo "download目录不存在"
RUN find /app -name "*.apk" -exec ls -lh {} \; 2>/dev/null || echo "未找到APK文件"

# 验证version.json（强制刷新缓存）
RUN echo "=== version.json 内容 ===" && cat server/public/version.json && echo "=== version.json 结束 ==="
RUN echo "构建时间: $(date)"
RUN echo "强制重新构建标记: v2.22.3"

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
