/**
 * WebRTC信令服务器
 * 用于Tesla WebRTC播放器的信令交换
 * 基于Node.js和WebSocket实现
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

class WebRTCSignalServer {
    constructor(options = {}) {
        this.port = options.port || 8080;
        this.host = options.host || 'localhost';
        this.debug = options.debug || false;
        
        this.server = null;
        this.wss = null;
        this.rooms = new Map(); // 房间管理
        this.clients = new Map(); // 客户端管理
        
        this.init();
    }
    
    /**
     * 初始化服务器
     */
    init() {
        try {
            // 创建HTTP服务器
            this.server = http.createServer((req, res) => {
                this.handleHttpRequest(req, res);
            });
            
            // 创建WebSocket服务器
            this.wss = new WebSocket.Server({ 
                server: this.server,
                path: '/signal'
            });
            
            // 处理WebSocket连接
            this.wss.on('connection', (ws, req) => {
                this.handleWebSocketConnection(ws, req);
            });
            
            this.log('WebRTC信令服务器初始化完成');
            
        } catch (error) {
            this.log('服务器初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 启动服务器
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, this.host, (error) => {
                if (error) {
                    this.log('服务器启动失败:', error);
                    reject(error);
                } else {
                    this.log(`WebRTC信令服务器启动成功: ws://${this.host}:${this.port}/signal`);
                    resolve();
                }
            });
        });
    }
    
    /**
     * 停止服务器
     */
    stop() {
        return new Promise((resolve) => {
            if (this.wss) {
                this.wss.close();
            }
            
            if (this.server) {
                this.server.close(() => {
                    this.log('WebRTC信令服务器已停止');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
    
    /**
     * 处理HTTP请求
     */
    handleHttpRequest(req, res) {
        const pathname = url.parse(req.url).pathname;
        
        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        switch (pathname) {
            case '/':
                this.sendResponse(res, 200, {
                    message: 'WebRTC信令服务器运行中',
                    version: '1.0.0',
                    endpoints: {
                        signal: '/signal',
                        status: '/status'
                    }
                });
                break;
                
            case '/status':
                this.sendResponse(res, 200, {
                    status: 'running',
                    rooms: this.rooms.size,
                    clients: this.clients.size,
                    uptime: process.uptime()
                });
                break;
                
            default:
                this.sendResponse(res, 404, { error: '页面未找到' });
        }
    }
    
    /**
     * 发送HTTP响应
     */
    sendResponse(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    }
    
    /**
     * 处理WebSocket连接
     */
    handleWebSocketConnection(ws, req) {
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            ws: ws,
            roomId: null,
            userAgent: null,
            connectedAt: new Date()
        };
        
        this.clients.set(clientId, clientInfo);
        this.log(`客户端连接: ${clientId}`);
        
        // 处理消息
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleSignalMessage(clientId, message);
            } catch (error) {
                this.log('解析消息失败:', error);
                this.sendError(clientId, '消息格式错误');
            }
        });
        
        // 处理断开连接
        ws.on('close', () => {
            this.handleClientDisconnect(clientId);
        });
        
        // 处理错误
        ws.on('error', (error) => {
            this.log(`客户端错误 ${clientId}:`, error);
            this.handleClientDisconnect(clientId);
        });
        
        // 发送欢迎消息
        this.sendMessage(clientId, {
            type: 'welcome',
            clientId: clientId
        });
    }
    
    /**
     * 处理信令消息
     */
    handleSignalMessage(clientId, message) {
        this.log(`收到消息 ${clientId}:`, message.type);
        
        const client = this.clients.get(clientId);
        if (!client) {
            this.log('客户端不存在:', clientId);
            return;
        }
        
        switch (message.type) {
            case 'join':
                this.handleJoinRoom(clientId, message);
                break;
                
            case 'leave':
                this.handleLeaveRoom(clientId);
                break;
                
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                this.relayMessage(clientId, message);
                break;
                
            case 'play-video':
                this.handlePlayVideo(clientId, message);
                break;
                
            default:
                this.log('未知消息类型:', message.type);
                this.sendError(clientId, '未知消息类型');
        }
    }
    
    /**
     * 处理加入房间
     */
    handleJoinRoom(clientId, message) {
        const { roomId, userAgent } = message;
        
        if (!roomId) {
            this.sendError(clientId, '房间ID不能为空');
            return;
        }
        
        const client = this.clients.get(clientId);
        client.roomId = roomId;
        client.userAgent = userAgent;
        
        // 创建或获取房间
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                clients: new Set(),
                createdAt: new Date()
            });
            this.log(`创建房间: ${roomId}`);
        }
        
        const room = this.rooms.get(roomId);
        room.clients.add(clientId);
        
        this.log(`客户端 ${clientId} 加入房间 ${roomId}`);
        
        // 通知客户端加入成功
        this.sendMessage(clientId, {
            type: 'room-joined',
            roomId: roomId,
            clientCount: room.clients.size
        });
        
        // 通知房间内其他客户端
        this.broadcastToRoom(roomId, {
            type: 'peer-joined',
            clientId: clientId,
            userAgent: userAgent
        }, clientId);
    }
    
    /**
     * 处理离开房间
     */
    handleLeaveRoom(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.roomId) {
            return;
        }
        
        const roomId = client.roomId;
        const room = this.rooms.get(roomId);
        
        if (room) {
            room.clients.delete(clientId);
            
            // 通知房间内其他客户端
            this.broadcastToRoom(roomId, {
                type: 'peer-left',
                clientId: clientId
            }, clientId);
            
            // 如果房间为空，删除房间
            if (room.clients.size === 0) {
                this.rooms.delete(roomId);
                this.log(`删除空房间: ${roomId}`);
            }
        }
        
        client.roomId = null;
        this.log(`客户端 ${clientId} 离开房间 ${roomId}`);
    }
    
    /**
     * 转发消息到房间内其他客户端
     */
    relayMessage(senderId, message) {
        const sender = this.clients.get(senderId);
        if (!sender || !sender.roomId) {
            this.sendError(senderId, '未加入房间');
            return;
        }
        
        this.broadcastToRoom(sender.roomId, {
            ...message,
            senderId: senderId
        }, senderId);
    }
    
    /**
     * 处理播放视频请求
     */
    handlePlayVideo(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || !client.roomId) {
            this.sendError(clientId, '未加入房间');
            return;
        }
        
        // 广播播放视频请求到房间内所有客户端
        this.broadcastToRoom(client.roomId, {
            type: 'play-video-request',
            videoUrl: message.videoUrl,
            requesterId: clientId
        });
        
        this.log(`播放视频请求: ${message.videoUrl}`);
    }
    
    /**
     * 广播消息到房间
     */
    broadcastToRoom(roomId, message, excludeClientId = null) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        
        room.clients.forEach(clientId => {
            if (clientId !== excludeClientId) {
                this.sendMessage(clientId, message);
            }
        });
    }
    
    /**
     * 发送消息给客户端
     */
    sendMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
            } catch (error) {
                this.log(`发送消息失败 ${clientId}:`, error);
            }
        }
    }
    
    /**
     * 发送错误消息
     */
    sendError(clientId, errorMessage) {
        this.sendMessage(clientId, {
            type: 'error',
            error: errorMessage
        });
    }
    
    /**
     * 处理客户端断开连接
     */
    handleClientDisconnect(clientId) {
        this.log(`客户端断开连接: ${clientId}`);
        
        // 离开房间
        this.handleLeaveRoom(clientId);
        
        // 删除客户端
        this.clients.delete(clientId);
    }
    
    /**
     * 生成客户端ID
     */
    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    /**
     * 日志输出
     */
    log(...args) {
        if (this.debug) {
            console.log('[WebRTC Signal Server]', new Date().toISOString(), ...args);
        }
    }
    
    /**
     * 获取服务器状态
     */
    getStatus() {
        return {
            running: true,
            rooms: Array.from(this.rooms.values()).map(room => ({
                id: room.id,
                clientCount: room.clients.size,
                createdAt: room.createdAt
            })),
            clients: Array.from(this.clients.values()).map(client => ({
                id: client.id,
                roomId: client.roomId,
                userAgent: client.userAgent,
                connectedAt: client.connectedAt
            }))
        };
    }
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
    const server = new WebRTCSignalServer({
        port: process.env.PORT || 8080,
        host: process.env.HOST || '0.0.0.0',
        debug: true
    });
    
    server.start().then(() => {
        console.log('WebRTC信令服务器启动成功');
    }).catch(error => {
        console.error('服务器启动失败:', error);
        process.exit(1);
    });
    
    // 优雅关闭
    process.on('SIGINT', async () => {
        console.log('\n正在关闭服务器...');
        await server.stop();
        process.exit(0);
    });
}

module.exports = WebRTCSignalServer;