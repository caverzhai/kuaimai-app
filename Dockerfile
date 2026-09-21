FROM node:20-alpine

WORKDIR /app

# 瀹夎wget锛堢敤浜庝粠GitHub涓嬭浇鏈€鏂皏ersion.json锛?RUN apk add --no-cache wget

# 缂撳瓨鐮村潖锛氭瘡娆℃瀯寤洪兘涓嶅悓锛屽己鍒禗ocker閲嶆柊鎵ц鍚庣画姝ラ
ARG CACHEBUST=20260921160000
RUN echo "Cache bust: $CACHEBUST"

# 澶嶅埗鍚庣浠ｇ爜鍜屽叡浜唬鐮?COPY server/ ./server/
COPY shared/ ./shared/

# 浠嶨itHub涓嬭浇鏈€鏂皏ersion.json锛圓PK澶ぇ锛岃烦杩囦笅杞斤級
RUN echo "=== 浠嶨itHub涓嬭浇鏈€鏂皏ersion.json ===" && \
    wget -O server/public/version.json "https://raw.githubusercontent.com/caverzhai/kuaimai-app/main/server/public/version.json" && \
    cat server/public/version.json

# 瀹夎渚濊禆骞舵瀯寤?WORKDIR /app/server
RUN npm install
RUN npm run build

# 鎵嬪姩澶嶅埗public鍒癲ist锛堢‘淇滱PK琚鍒讹級
# public is already in dist/server/public, no extra copy needed

# 楠岃瘉鏋勫缓浜х墿
RUN ls -la dist/server/main.js && echo "Build successful"

# 鍥炲埌 app 鐩綍
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/main.js"]

