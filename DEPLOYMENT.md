# Tesla LibreTV 部署指南

## 📋 部署概述

Tesla LibreTV 是一个专为特斯拉车机优化的视频播放平台，支持多种部署方式和环境。

## 🚀 快速部署

### 方式一：Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/your-username/LibreTV.git
cd LibreTV

# 使用 Docker Compose 启动
docker-compose up -d
```

### 方式二：Node.js 部署

```bash
# 安装依赖
npm install
cd server && npm install

# 启动服务
npm start
```

### 方式三：静态部署

```bash
# 直接部署到静态托管服务
# 支持：Vercel, Netlify, GitHub Pages
```

## 🔧 环境配置

### 环境变量

创建 `.env` 文件：

```env
# 基础配置
PORT=8080
PROXY_PORT=3001
WEBRTC_PORT=3002

# 代理配置
PROXY_TARGET=https://your-video-source.com
PROXY_TIMEOUT=30000

# WebRTC 配置
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=turn:your-turn-server.com
TURN_USERNAME=username
TURN_PASSWORD=password

# Tesla 优化
TESLA_MODE=true
TESLA_CACHE_SIZE=100MB
TESLA_MAX_BITRATE=2000000

# 安全配置
CSP_ENABLED=true
CORS_ORIGIN=*
RATE_LIMIT=100

# 监控配置
MONITORING_ENABLED=true
LOG_LEVEL=info
```

### 配置文件

#### `config/production.json`
```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "ssl": false
  },
  "proxy": {
    "enabled": true,
    "port": 3001,
    "timeout": 30000,
    "maxConnections": 100
  },
  "webrtc": {
    "enabled": true,
    "port": 3002,
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ]
  },
  "tesla": {
    "optimizations": true,
    "cacheSize": "100MB",
    "maxBitrate": 2000000,
    "fallbackEnabled": true
  },
  "security": {
    "csp": true,
    "cors": true,
    "rateLimit": 100
  }
}
```

## 🐳 Docker 部署

### Dockerfile 优化

```dockerfile
# 多阶段构建
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 8080 3001 3002
CMD ["npm", "start"]
```

### Docker Compose 配置

```yaml
version: '3.8'

services:
  libretv:
    build: .
    ports:
      - "8080:8080"
      - "3001:3001"
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - TESLA_MODE=true
    volumes:
      - ./logs:/app/logs
      - ./cache:/app/cache
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - libretv
    restart: unless-stopped

volumes:
  redis_data:
```

## ☁️ 云平台部署

### Vercel 部署

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.mjs",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "env": {
    "TESLA_MODE": "true",
    "NODE_ENV": "production"
  }
}
```

### Netlify 部署

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
  TESLA_MODE = "true"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[functions]
  directory = "netlify/functions"
```

### Railway 部署

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 🔒 安全配置

### HTTPS 配置

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://libretv:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /proxy/ {
        proxy_pass http://libretv:3001/;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    location /webrtc/ {
        proxy_pass http://libretv:3002/;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 防火墙配置

```bash
# UFW 配置
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 3002/tcp
sudo ufw enable
```

## 📊 监控和日志

### 健康检查端点

```javascript
// /health
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "services": {
    "proxy": "healthy",
    "webrtc": "healthy",
    "database": "healthy"
  },
  "tesla": {
    "optimizations": true,
    "fallback": "available"
  }
}
```

### 日志配置

```javascript
// logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## 🚗 Tesla 特定优化

### 车机环境检测

```javascript
// tesla-detector.js
function detectTeslaEnvironment() {
  const userAgent = navigator.userAgent;
  const isTesla = /Tesla/i.test(userAgent);
  
  if (isTesla) {
    // 启用 Tesla 优化
    enableTeslaOptimizations();
  }
  
  return {
    isTesla,
    model: extractTeslaModel(userAgent),
    version: extractTeslaVersion(userAgent)
  };
}
```

### 性能优化

```javascript
// tesla-optimizations.js
const teslaConfig = {
  // 降低视频质量以适应车机性能
  maxBitrate: 2000000, // 2Mbps
  maxResolution: '1920x1200',
  
  // 启用硬件加速
  hardwareAcceleration: true,
  
  // 优化缓冲策略
  bufferSize: 30, // 30秒
  preloadTime: 10, // 10秒预加载
  
  // 网络优化
  connectionTimeout: 15000,
  retryAttempts: 3,
  
  // UI 优化
  touchOptimized: true,
  largeButtons: true,
  simplifiedUI: true
};
```

## 🔄 CI/CD 配置

### GitHub Actions

```yaml
name: Deploy Tesla LibreTV

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd server && npm ci
      
      - name: Run tests
        run: |
          npm test
          npm run test:tesla
      
      - name: Run security audit
        run: npm audit --audit-level moderate
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          # 部署到生产环境
          echo "Deploying to production..."
```

## 📈 性能优化

### 缓存策略

```javascript
// cache-config.js
const cacheConfig = {
  // 静态资源缓存
  static: {
    maxAge: 31536000, // 1年
    immutable: true
  },
  
  // API 响应缓存
  api: {
    maxAge: 300, // 5分钟
    staleWhileRevalidate: 60
  },
  
  // 视频内容缓存
  video: {
    maxAge: 86400, // 1天
    maxSize: '500MB'
  }
};
```

### CDN 配置

```javascript
// cdn-config.js
const cdnConfig = {
  // 静态资源 CDN
  static: 'https://cdn.your-domain.com',
  
  // 视频内容 CDN
  video: 'https://video-cdn.your-domain.com',
  
  // 地理分布
  regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1']
};
```

## 🔍 故障排除

### 常见问题

1. **代理服务器无法启动**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep :3001
   
   # 杀死占用进程
   sudo kill -9 <PID>
   ```

2. **WebRTC 连接失败**
   ```bash
   # 检查防火墙设置
   sudo ufw status
   
   # 检查 STUN/TURN 服务器
   curl -I https://stun.l.google.com:19302
   ```

3. **Tesla 车机兼容性问题**
   - 检查用户代理字符串
   - 验证 CSP 策略
   - 测试网络连接

### 调试工具

```bash
# 启用调试模式
DEBUG=libretv:* npm start

# 查看实时日志
tail -f logs/combined.log

# 性能分析
node --inspect server.mjs
```

## 📞 支持

- 📧 邮箱：support@your-domain.com
- 💬 Discord：https://discord.gg/your-server
- 📖 文档：https://docs.your-domain.com
- 🐛 问题报告：https://github.com/your-username/LibreTV/issues

---

**注意**：在特斯拉车机环境中部署前，请确保已在PC端完成充分测试。建议使用提供的测试工具套件进行全面验证。