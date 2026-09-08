FROM node:20-alpine

WORKDIR /app

# 复制后端代码和共享代码
COPY server/ ./server/
COPY shared/ ./shared/

# 安装依赖并构建
WORKDIR /app/server
RUN npm install
RUN npm run build

# 验证构建产物
RUN ls -la dist/server/main.js && echo "Build successful"

# 回到 app 目录
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/main.js"]
