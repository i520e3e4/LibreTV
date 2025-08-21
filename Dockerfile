# Tesla LibreTV Dockerfile
# 多阶段构建优化镜像大小和安全性

# 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY server/package*.json ./server/

# 安装依赖（仅生产依赖）
RUN npm ci --only=production --silent
RUN cd server && npm ci --only=production --silent

# 运行时阶段
FROM node:18-alpine AS runtime

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S libretv -u 1001

# 设置工作目录
WORKDIR /app

# 安装必要的系统包
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# 从构建阶段复制依赖
COPY --from=builder --chown=libretv:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=libretv:nodejs /app/server/node_modules ./server/node_modules

# 复制应用代码
COPY --chown=libretv:nodejs . .

# 创建必要的目录
RUN mkdir -p logs cache temp && \
    chown -R libretv:nodejs logs cache temp

# 设置环境变量
ENV NODE_ENV=production
ENV TESLA_MODE=true
ENV PORT=8080
ENV PROXY_PORT=3001
ENV WEBRTC_PORT=3002

# 暴露端口
EXPOSE 8080 3001 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 切换到非 root 用户
USER libretv

# 启动应用
CMD ["npm", "start"]
