# Tesla WebRTC视频播放解决方案

## 概述

本解决方案通过WebRTC技术绕过特斯拉车机浏览器的HTML5视频播放限制，实现在特斯拉车机上播放视频的功能。

## 问题背景

特斯拉车机浏览器存在以下限制：
- 行车模式下禁用HTML5 `<video>` 标签播放
- 驻车模式下也可能存在视频播放限制
- 出于安全考虑，系统级别阻止视频播放

## 解决方案

### WebRTC技术方案

通过WebRTC P2P连接绕过浏览器视频限制：
1. 使用WebSocket信令服务器协调连接
2. 建立WebRTC数据通道传输视频流
3. 在客户端使用Canvas或WebGL渲染视频
4. 避免使用被限制的HTML5 `<video>` 标签

## 文件结构

```
LibreTV/
├── js/
│   └── tesla-webrtc-player.js     # WebRTC播放器客户端
├── server/
│   ├── webrtc-signal-server.js    # 信令服务器
│   └── package.json               # 服务器依赖
├── tesla-webrtc-test.html          # 测试页面
├── start-webrtc-server.bat         # 启动脚本
├── tesla-technical-analysis.md     # 技术分析文档
└── README-WebRTC.md               # 本文档
```

## 快速开始

### 1. 环境要求

- Node.js 14.0.0 或更高版本
- 现代浏览器（支持WebRTC）
- 网络连接（用于STUN服务器）

### 2. 启动信令服务器

#### 方法一：使用启动脚本（推荐）
```bash
# Windows
double-click start-webrtc-server.bat

# 或在命令行中运行
start-webrtc-server.bat
```

#### 方法二：手动启动
```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 启动服务器
npm start
```

### 3. 测试WebRTC功能

1. 启动信令服务器后，打开浏览器访问：
   ```
   http://localhost:8080
   ```

2. 或直接打开测试页面：
   ```
   tesla-webrtc-test.html
   ```

3. 在测试页面中：
   - 确认信令服务器地址：`ws://localhost:8080/signal`
   - 设置房间ID（可使用默认值）
   - 点击"连接服务器"按钮
   - 观察连接状态和日志输出

## 使用方法

### 在现有项目中集成

1. 引入WebRTC播放器：
```html
<script src="js/tesla-webrtc-player.js"></script>
```

2. 创建播放器实例：
```javascript
const player = new TeslaWebRTCPlayer({
    container: document.getElementById('video-container'),
    signalServerUrl: 'ws://your-server:8080/signal',
    roomId: 'your-room-id',
    debug: true,
    onReady: () => {
        console.log('播放器准备就绪');
    },
    onError: (error) => {
        console.error('播放器错误:', error);
    },
    onStatusChange: (status) => {
        console.log('状态变化:', status);
    },
    onVideoReceived: () => {
        console.log('视频流接收成功');
    }
});
```

3. 播放视频：
```javascript
// 发送播放请求
player.sendSignalMessage({
    type: 'play-video',
    videoUrl: 'your-video-url'
});
```

### 在特斯拉车机中使用

1. 确保信令服务器可以从特斯拉车机访问
2. 将项目部署到可访问的Web服务器
3. 在特斯拉浏览器中打开项目页面
4. 测试WebRTC连接和视频播放功能

## API文档

### TeslaWebRTCPlayer

#### 构造函数选项

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| container | HTMLElement | document.body | 视频容器元素 |
| signalServerUrl | string | 'ws://localhost:8080/signal' | 信令服务器地址 |
| roomId | string | 'tesla-room-' + timestamp | 房间ID |
| debug | boolean | false | 是否启用调试模式 |
| onReady | function | () => {} | 播放器准备就绪回调 |
| onError | function | console.error | 错误处理回调 |
| onStatusChange | function | () => {} | 状态变化回调 |
| onVideoReceived | function | () => {} | 视频接收回调 |

#### 主要方法

- `sendSignalMessage(message)` - 发送信令消息
- `destroy()` - 销毁播放器实例

### 信令服务器API

#### WebSocket消息类型

- `join` - 加入房间
- `leave` - 离开房间
- `offer` - WebRTC Offer
- `answer` - WebRTC Answer
- `ice-candidate` - ICE候选
- `play-video` - 播放视频请求

#### HTTP端点

- `GET /` - 服务器状态信息
- `GET /status` - 详细状态信息

## 故障排除

### 常见问题

1. **信令服务器连接失败**
   - 检查服务器是否正常启动
   - 确认防火墙设置
   - 验证WebSocket地址是否正确

2. **WebRTC连接失败**
   - 检查网络连接
   - 确认STUN服务器可访问
   - 查看浏览器控制台错误信息

3. **视频无法播放**
   - 确认视频源格式支持
   - 检查编解码器兼容性
   - 验证网络带宽是否足够

### 调试技巧

1. 启用调试模式：
```javascript
const player = new TeslaWebRTCPlayer({
    debug: true,
    // 其他选项...
});
```

2. 查看浏览器控制台日志
3. 使用测试页面验证功能
4. 检查网络连接状态

## 技术限制

1. **网络要求**
   - 需要稳定的网络连接
   - 可能需要NAT穿透
   - 带宽要求较高

2. **浏览器兼容性**
   - 需要支持WebRTC的现代浏览器
   - 特斯拉车机浏览器版本限制

3. **性能考虑**
   - CPU使用率较高
   - 电池消耗增加
   - 可能影响其他车机功能

## 安全考虑

1. **网络安全**
   - 使用HTTPS/WSS加密连接
   - 验证信令服务器身份
   - 限制访问权限

2. **驾驶安全**
   - 遵守当地法律法规
   - 避免在驾驶时观看视频
   - 考虑自动检测驾驶状态

## 未来改进

1. **功能增强**
   - 支持多种视频格式
   - 添加音频同步
   - 实现自适应码率

2. **性能优化**
   - 减少CPU使用率
   - 优化内存占用
   - 改善网络效率

3. **用户体验**
   - 简化配置流程
   - 添加可视化状态指示
   - 提供更好的错误提示

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 创建GitHub Issue
- 发送邮件至项目维护者

---

**注意**: 本解决方案仅用于技术研究和测试目的。在实际使用中，请确保遵守当地法律法规，特别是关于驾驶安全的规定。