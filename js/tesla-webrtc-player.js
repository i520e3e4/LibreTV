/**
 * Tesla WebRTC视频播放器
 * 用于绕过特斯拉车机HTML5视频播放限制
 * 通过WebRTC技术实现视频流传输
 */

class TeslaWebRTCPlayer {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.signalServerUrl = options.signalServerUrl || 'ws://localhost:8080/signal';
        this.roomId = options.roomId || 'tesla-room-' + Date.now();
        this.debug = options.debug || false;
        
        // WebRTC配置
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' }
            ]
        };
        
        // 状态管理
        this.isConnected = false;
        this.isPlaying = false;
        this.peerConnection = null;
        this.websocket = null;
        this.videoElement = null;
        this.audioContext = null;
        this.clientId = null;
        this.remoteStream = null;
        
        // 重连机制
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // 事件回调
        this.onReady = options.onReady || (() => {});
        this.onError = options.onError || ((error) => console.error('WebRTC Player Error:', error));
        this.onStatusChange = options.onStatusChange || (() => {});
        this.onVideoReceived = options.onVideoReceived || (() => {});
        
        this.init();
    }
    
    /**
     * 初始化WebRTC播放器
     */
    async init() {
        try {
            this.log('初始化Tesla WebRTC播放器...');
            
            // 检查WebRTC支持
            if (!this.checkWebRTCSupport()) {
                throw new Error('当前浏览器不支持WebRTC');
            }
            
            // 初始化事件监听器
            this.eventListeners = {};
            
            // 创建视频元素
            this.createVideoElements();
            
            // 初始化音频上下文（用于音频回退）
            if (options && options.audioFallback) {
                await this.initAudioContext();
            }
            
            this.log('Tesla WebRTC播放器初始化完成');
            this.onReady();
        } catch (error) {
            this.handleError('初始化失败', error);
        }
    }
    
    /**
     * 连接信令服务器
     */
    async connectSignalServer() {
        return new Promise((resolve, reject) => {
            try {
                this.log('连接信令服务器:', this.signalServerUrl);
                
                this.websocket = new WebSocket(this.signalServerUrl);
                
                this.websocket.onopen = () => {
                    this.log('信令服务器连接成功');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // 加入房间
                    this.joinRoom();
                    
                    this.onStatusChange('connected');
                    resolve();
                };
                
                this.websocket.onmessage = (event) => {
                    this.handleSignalMessage(event.data);
                };
                
                this.websocket.onclose = () => {
                    this.log('信令服务器连接关闭');
                    this.isConnected = false;
                    this.onStatusChange('disconnected');
                    
                    // 尝试重连
                    this.attemptReconnect();
                };
                
                this.websocket.onerror = (error) => {
                    this.log('信令服务器连接错误:', error);
                    this.onError(error);
                    reject(error);
                };
                
            } catch (error) {
                this.log('创建WebSocket连接失败:', error);
                reject(error);
            }
        });
    }
    
    /**
     * 加入房间
     */
    joinRoom() {
        if (!this.isConnected) {
            this.log('未连接到信令服务器');
            return;
        }
        
        const message = {
            type: 'join',
            roomId: this.roomId,
            userAgent: navigator.userAgent
        };
        
        this.sendSignalMessage(message);
        this.log('加入房间:', this.roomId);
    }
    
    /**
     * 尝试重连
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.log('达到最大重连次数，停止重连');
            this.onError(new Error('连接失败，已达到最大重连次数'));
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        this.log(`${delay}ms后尝试第${this.reconnectAttempts}次重连`);
        
        setTimeout(() => {
            this.connectSignalServer().catch(error => {
                this.log('重连失败:', error);
            });
        }, delay);
    }
    
    /**
     * 发送信令消息
     */
    sendSignalMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        } else {
            this.log('WebSocket未连接，无法发送消息');
        }
    }
    
    /**
     * 检查WebRTC支持
     */
    checkWebRTCSupport() {
        return !!(window.RTCPeerConnection && 
                 window.RTCSessionDescription && 
                 window.RTCIceCandidate);
    }
    
    /**
     * 创建视频元素
     */
    createVideoElements() {
        // 创建远程视频元素
        this.videoElement = document.createElement('video');
        this.videoElement.id = 'tesla-webrtc-video';
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.muted = false;
        this.videoElement.controls = true;
        
        // 设置视频样式
        this.videoElement.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
            border-radius: 8px;
        `;
        
        // 添加到容器
        this.container.appendChild(this.videoElement);
        
        // 添加事件监听
        this.videoElement.addEventListener('loadstart', () => {
            this.log('视频开始加载');
        });
        
        this.videoElement.addEventListener('canplay', () => {
            this.log('视频可以播放');
            this.isPlaying = true;
            this.onVideoReceived();
        });
        
        this.videoElement.addEventListener('error', (e) => {
            this.handleError('视频播放错误', e);
        });
    }
    
    /**
     * 初始化音频上下文
     */
    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.log('音频上下文初始化成功');
        } catch (error) {
            this.log('音频上下文初始化失败:', error);
        }
    }
    
    /**
     * 连接到信令服务器
     */
    async connect(roomId = 'tesla-room') {
        try {
            this.log(`连接到信令服务器: ${this.options.signalServerUrl}`);
            
            // 创建WebSocket连接
            this.websocket = new WebSocket(this.options.signalServerUrl);
            
            this.websocket.onopen = () => {
                this.log('信令服务器连接成功');
                this.isConnected = true;
                
                // 加入房间
                this.sendSignal({
                    type: 'join',
                    roomId: roomId,
                    userAgent: navigator.userAgent
                });
                
                this.emit('connected');
            };
            
            this.websocket.onmessage = (event) => {
                this.handleSignalMessage(JSON.parse(event.data));
            };
            
            this.websocket.onclose = () => {
                this.log('信令服务器连接关闭');
                this.isConnected = false;
                this.emit('disconnected');
            };
            
            this.websocket.onerror = (error) => {
                this.handleError('信令服务器连接错误', error);
            };
            
        } catch (error) {
            this.handleError('连接失败', error);
        }
    }
    
    /**
     * 创建WebRTC连接
     */
    async createPeerConnection() {
        try {
            this.log('创建WebRTC连接...');
            
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);
            
            // 处理ICE候选
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendSignalMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate
                    });
                }
            };
            
            // 处理远程流
            this.peerConnection.ontrack = (event) => {
                this.log('接收到远程视频流');
                
                if (event.streams && event.streams[0]) {
                    this.remoteStream = event.streams[0];
                    this.videoElement.srcObject = this.remoteStream;
                    
                    // 尝试播放
                    this.videoElement.play().catch(error => {
                        this.log('自动播放失败，需要用户交互:', error);
                        this.showPlayButton();
                    });
                }
            };
            
            // 连接状态变化
            this.peerConnection.onconnectionstatechange = () => {
                this.log('连接状态:', this.peerConnection.connectionState);
                this.onStatusChange(this.peerConnection.connectionState);
                
                if (this.peerConnection.connectionState === 'failed') {
                    this.handleError('WebRTC连接失败');
                }
            };
            
            this.log('WebRTC连接创建成功');
            
        } catch (error) {
            this.handleError('创建WebRTC连接失败', error);
        }
    }
    
    /**
     * 处理信令消息
     */
    async handleSignalMessage(message) {
        try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            this.log('收到信令消息:', data.type);
            
            switch (data.type) {
                case 'offer':
                    await this.handleOffer(data.offer);
                    break;
                    
                case 'answer':
                    await this.handleAnswer(data.answer);
                    break;
                    
                case 'ice-candidate':
                    await this.handleIceCandidate(data.candidate);
                    break;
                    
                case 'room-joined':
                    this.log('成功加入房间');
                    await this.createPeerConnection();
                    break;
                    
                case 'peer-joined':
                    this.log('有新用户加入');
                    break;
                    
                case 'error':
                    this.handleError('信令错误', data.error);
                    break;
                    
                default:
                    this.log('未知信令消息类型:', data.type);
            }
        } catch (error) {
            this.handleError('处理信令消息失败', error);
        }
    }
    
    /**
     * 创建Offer
     */
    async createOffer() {
        try {
            if (!this.peerConnection) {
                await this.createPeerConnection();
            }
            
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.sendSignalMessage({
                type: 'offer',
                offer: offer
            });
            
            this.log('Offer创建并发送完成');
            
        } catch (error) {
            this.handleError('创建Offer失败', error);
        }
    }
    
    /**
     * 处理Offer
     */
    async handleOffer(offer) {
        try {
            if (!this.peerConnection) {
                await this.createPeerConnection();
            }
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.sendSignalMessage({
                type: 'answer',
                answer: answer
            });
            
            this.log('Answer创建并发送完成');
            
        } catch (error) {
            this.handleError('处理Offer失败', error);
        }
    }
    
    /**
     * 处理Answer
     */
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            this.log('Answer处理完成');
            
        } catch (error) {
            this.handleError('处理Answer失败', error);
        }
    }
    
    /**
     * 处理ICE候选
     */
    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                this.log('ICE候选添加完成');
            }
            
        } catch (error) {
            this.handleError('处理ICE候选失败', error);
        }
    }
    
    /**
     * 发送信令消息
     */
    sendSignal(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        }
    }
    
    /**
     * 显示播放按钮（当自动播放失败时）
     */
    showPlayButton() {
        const playButton = document.createElement('button');
        playButton.textContent = '点击播放视频';
        playButton.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 12px 24px;
            font-size: 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            z-index: 1000;
        `;
        
        playButton.onclick = () => {
            this.remoteVideo.play();
            playButton.remove();
        };
        
        this.options.videoContainer.appendChild(playButton);
    }
    
    /**
     * 请求播放视频
     */
    async playVideo(videoUrl) {
        try {
            this.log(`请求播放视频: ${videoUrl}`);
            
            if (!this.isConnected) {
                throw new Error('未连接到信令服务器');
            }
            
            this.sendSignal({
                type: 'play-video',
                videoUrl: videoUrl
            });
            
        } catch (error) {
            this.handleError('播放视频失败', error);
        }
    }
    
    /**
     * 停止播放
     */
    stop() {
        try {
            this.log('停止播放');
            
            if (this.remoteVideo) {
                this.remoteVideo.pause();
                this.remoteVideo.srcObject = null;
            }
            
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            this.isPlaying = false;
            this.emit('videoStopped');
            
        } catch (error) {
            this.handleError('停止播放失败', error);
        }
    }
    
    /**
     * 断开连接
     */
    disconnect() {
        try {
            this.log('断开连接');
            
            this.stop();
            
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }
            
            this.isConnected = false;
            
        } catch (error) {
            this.handleError('断开连接失败', error);
        }
    }
    
    /**
     * 销毁播放器
     */
    destroy() {
        try {
            this.log('销毁播放器');
            
            this.disconnect();
            
            if (this.remoteVideo) {
                this.remoteVideo.remove();
                this.remoteVideo = null;
            }
            
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            this.eventListeners = {};
            
        } catch (error) {
            this.handleError('销毁播放器失败', error);
        }
    }
    
    /**
     * 添加事件监听器
     */
    on(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].push(callback);
        }
    }
    
    /**
     * 移除事件监听器
     */
    off(event, callback) {
        if (this.eventListeners[event]) {
            const index = this.eventListeners[event].indexOf(callback);
            if (index > -1) {
                this.eventListeners[event].splice(index, 1);
            }
        }
    }
    
    /**
     * 触发事件
     */
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log('事件回调执行失败:', error);
                }
            });
        }
    }
    
    /**
     * 错误处理
     */
    handleError(message, error) {
        const errorInfo = {
            message: message,
            error: error,
            timestamp: new Date().toISOString()
        };
        
        this.log('错误:', errorInfo);
        this.emit('error', errorInfo);
    }
    
    /**
     * 日志输出
     */
    log(...args) {
        if (this.options.debug) {
            console.log('[Tesla WebRTC Player]', ...args);
        }
    }
    
    /**
     * 获取播放器状态
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isPlaying: this.isPlaying,
            connectionState: this.peerConnection ? this.peerConnection.connectionState : 'closed',
            iceConnectionState: this.peerConnection ? this.peerConnection.iceConnectionState : 'closed'
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaWebRTCPlayer;
} else if (typeof window !== 'undefined') {
    window.TeslaWebRTCPlayer = TeslaWebRTCPlayer;
}