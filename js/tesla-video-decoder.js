/**
 * Tesla视频解码器
 * 自定义视频解码器，用于在特斯拉车机上解码视频流
 */

class TeslaVideoDecoder {
    constructor(options = {}) {
        this.options = {
            enableWorker: options.enableWorker !== false,
            maxBufferSize: options.maxBufferSize || 50, // 最大缓冲帧数
            targetFPS: options.targetFPS || 30,
            enableAudio: options.enableAudio !== false,
            ...options
        };
        
        this.isDecoding = false;
        this.frameBuffer = [];
        this.audioBuffer = [];
        this.currentTime = 0;
        this.duration = 0;
        this.frameRate = this.options.targetFPS;
        this.worker = null;
        this.canvas = null;
        this.ctx = null;
        
        this.callbacks = {
            onFrame: null,
            onAudio: null,
            onProgress: null,
            onError: null,
            onEnd: null
        };
        
        this.init();
    }

    /**
     * 初始化解码器
     */
    init() {
        this.createOffscreenCanvas();
        if (this.options.enableWorker) {
            this.initWorker();
        }
    }

    /**
     * 创建离屏Canvas用于图像处理
     */
    createOffscreenCanvas() {
        try {
            if (typeof OffscreenCanvas !== 'undefined') {
                this.canvas = new OffscreenCanvas(1920, 1080);
            } else {
                this.canvas = document.createElement('canvas');
                this.canvas.width = 1920;
                this.canvas.height = 1080;
            }
            this.ctx = this.canvas.getContext('2d');
        } catch (e) {
            console.warn('离屏Canvas创建失败，使用普通Canvas:', e);
            this.canvas = document.createElement('canvas');
            this.canvas.width = 1920;
            this.canvas.height = 1080;
            this.ctx = this.canvas.getContext('2d');
        }
    }

    /**
     * 初始化Web Worker
     */
    initWorker() {
        try {
            const workerCode = this.getWorkerCode();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));
            
            this.worker.onmessage = (e) => {
                this.handleWorkerMessage(e.data);
            };
            
            this.worker.onerror = (e) => {
                console.error('Worker错误:', e);
                this.options.enableWorker = false;
            };
        } catch (e) {
            console.warn('Worker初始化失败:', e);
            this.options.enableWorker = false;
        }
    }

    /**
     * 获取Worker代码
     */
    getWorkerCode() {
        return `
            // Tesla Video Decoder Worker
            let frameBuffer = [];
            let isProcessing = false;
            
            self.onmessage = function(e) {
                const { type, data } = e.data;
                
                switch (type) {
                    case 'decode':
                        decodeSegment(data);
                        break;
                    case 'clear':
                        frameBuffer = [];
                        break;
                    case 'getFrame':
                        getFrame(data.timestamp);
                        break;
                }
            };
            
            function decodeSegment(segmentData) {
                try {
                    // 模拟视频解码过程
                    // 在实际实现中，这里需要使用真正的视频解码库
                    const frames = parseVideoSegment(segmentData);
                    frameBuffer.push(...frames);
                    
                    self.postMessage({
                        type: 'decoded',
                        frames: frames.length,
                        bufferSize: frameBuffer.length
                    });
                } catch (e) {
                    self.postMessage({
                        type: 'error',
                        error: e.message
                    });
                }
            }
            
            function parseVideoSegment(data) {
                // 简化的视频段解析
                // 实际实现需要解析TS段或MP4段
                const frames = [];
                const frameCount = Math.floor(data.byteLength / 10000); // 估算帧数
                
                for (let i = 0; i < frameCount; i++) {
                    frames.push({
                        timestamp: Date.now() + i * (1000 / 30),
                        data: data.slice(i * 10000, (i + 1) * 10000),
                        type: 'video'
                    });
                }
                
                return frames;
            }
            
            function getFrame(timestamp) {
                const frame = frameBuffer.find(f => 
                    Math.abs(f.timestamp - timestamp) < 50
                );
                
                if (frame) {
                    self.postMessage({
                        type: 'frame',
                        frame: frame
                    });
                } else {
                    self.postMessage({
                        type: 'noFrame',
                        timestamp: timestamp
                    });
                }
            }
        `;
    }

    /**
     * 处理Worker消息
     */
    handleWorkerMessage(data) {
        switch (data.type) {
            case 'decoded':
                if (this.callbacks.onProgress) {
                    this.callbacks.onProgress({
                        frames: data.frames,
                        bufferSize: data.bufferSize
                    });
                }
                break;
                
            case 'frame':
                this.processFrame(data.frame);
                break;
                
            case 'error':
                if (this.callbacks.onError) {
                    this.callbacks.onError(new Error(data.error));
                }
                break;
        }
    }

    /**
     * 加载视频源
     */
    async loadSource(url) {
        try {
            this.isDecoding = true;
            
            if (url.includes('.m3u8')) {
                await this.loadHLSSource(url);
            } else {
                await this.loadDirectSource(url);
            }
        } catch (e) {
            if (this.callbacks.onError) {
                this.callbacks.onError(e);
            }
        }
    }

    /**
     * 加载HLS源
     */
    async loadHLSSource(url) {
        try {
            // 获取m3u8播放列表
            const response = await fetch(url);
            const playlist = await response.text();
            
            // 解析播放列表
            const segments = this.parseM3U8(playlist, url);
            
            // 逐个加载和解码段
            for (const segment of segments) {
                await this.loadSegment(segment);
            }
        } catch (e) {
            throw new Error(`HLS加载失败: ${e.message}`);
        }
    }

    /**
     * 解析M3U8播放列表
     */
    parseM3U8(content, baseUrl) {
        const lines = content.split('\n').filter(line => line.trim());
        const segments = [];
        let duration = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                duration = parseFloat(line.split(':')[1]);
            } else if (line && !line.startsWith('#')) {
                const segmentUrl = this.resolveUrl(line, baseUrl);
                segments.push({
                    url: segmentUrl,
                    duration: duration
                });
            }
        }
        
        return segments;
    }

    /**
     * 解析相对URL
     */
    resolveUrl(url, baseUrl) {
        if (url.startsWith('http')) {
            return url;
        }
        
        const base = new URL(baseUrl);
        return new URL(url, base.origin + base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1)).href;
    }

    /**
     * 加载视频段
     */
    async loadSegment(segment) {
        try {
            const response = await fetch(segment.url);
            const data = await response.arrayBuffer();
            
            if (this.options.enableWorker && this.worker) {
                this.worker.postMessage({
                    type: 'decode',
                    data: data
                });
            } else {
                await this.decodeSegment(data);
            }
        } catch (e) {
            console.warn(`段加载失败: ${segment.url}`, e);
        }
    }

    /**
     * 解码视频段（主线程版本）
     */
    async decodeSegment(data) {
        try {
            // 简化的解码过程
            // 实际实现需要使用专业的视频解码库
            const frames = await this.parseVideoData(data);
            
            for (const frame of frames) {
                this.frameBuffer.push(frame);
                
                // 限制缓冲区大小
                if (this.frameBuffer.length > this.options.maxBufferSize) {
                    this.frameBuffer.shift();
                }
            }
            
            if (this.callbacks.onProgress) {
                this.callbacks.onProgress({
                    frames: frames.length,
                    bufferSize: this.frameBuffer.length
                });
            }
        } catch (e) {
            if (this.callbacks.onError) {
                this.callbacks.onError(e);
            }
        }
    }

    /**
     * 解析视频数据
     */
    async parseVideoData(data) {
        // 这是一个简化的实现
        // 实际需要解析TS或MP4格式的视频数据
        const frames = [];
        
        try {
            // 创建临时video元素进行解码
            const video = document.createElement('video');
            video.muted = true;
            video.style.display = 'none';
            document.body.appendChild(video);
            
            // 创建Blob URL
            const blob = new Blob([data], { type: 'video/mp2t' });
            const url = URL.createObjectURL(blob);
            video.src = url;
            
            return new Promise((resolve) => {
                video.addEventListener('loadeddata', () => {
                    this.extractFramesFromVideo(video).then(frames => {
                        document.body.removeChild(video);
                        URL.revokeObjectURL(url);
                        resolve(frames);
                    });
                });
                
                video.addEventListener('error', () => {
                    document.body.removeChild(video);
                    URL.revokeObjectURL(url);
                    resolve([]);
                });
            });
        } catch (e) {
            console.warn('视频解析失败:', e);
            return [];
        }
    }

    /**
     * 从video元素提取帧
     */
    async extractFramesFromVideo(video) {
        const frames = [];
        const duration = video.duration || 10; // 默认10秒
        const frameInterval = 1 / this.frameRate;
        
        for (let time = 0; time < duration; time += frameInterval) {
            video.currentTime = time;
            
            await new Promise(resolve => {
                video.addEventListener('seeked', resolve, { once: true });
            });
            
            // 将当前帧绘制到Canvas
            this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            frames.push({
                timestamp: time * 1000,
                data: imageData,
                type: 'video'
            });
        }
        
        return frames;
    }

    /**
     * 加载直接视频源
     */
    async loadDirectSource(url) {
        try {
            const response = await fetch(url);
            const data = await response.arrayBuffer();
            await this.decodeSegment(data);
        } catch (e) {
            throw new Error(`直接源加载失败: ${e.message}`);
        }
    }

    /**
     * 获取指定时间的帧
     */
    getFrame(timestamp) {
        if (this.options.enableWorker && this.worker) {
            this.worker.postMessage({
                type: 'getFrame',
                data: { timestamp }
            });
        } else {
            const frame = this.frameBuffer.find(f => 
                Math.abs(f.timestamp - timestamp) < 50
            );
            
            if (frame) {
                this.processFrame(frame);
            }
        }
    }

    /**
     * 处理帧数据
     */
    processFrame(frame) {
        if (this.callbacks.onFrame) {
            this.callbacks.onFrame(frame.data);
        }
    }

    /**
     * 设置回调函数
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase()}${event.slice(1)}`)) {
            this.callbacks[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`] = callback;
        }
    }

    /**
     * 开始播放
     */
    play() {
        this.isDecoding = true;
        this.startFrameLoop();
    }

    /**
     * 暂停播放
     */
    pause() {
        this.isDecoding = false;
        if (this.frameLoopId) {
            cancelAnimationFrame(this.frameLoopId);
        }
    }

    /**
     * 开始帧循环
     */
    startFrameLoop() {
        const frameInterval = 1000 / this.frameRate;
        let lastTime = 0;
        
        const loop = (currentTime) => {
            if (!this.isDecoding) return;
            
            if (currentTime - lastTime >= frameInterval) {
                this.getFrame(this.currentTime);
                this.currentTime += frameInterval;
                lastTime = currentTime;
            }
            
            this.frameLoopId = requestAnimationFrame(loop);
        };
        
        this.frameLoopId = requestAnimationFrame(loop);
    }

    /**
     * 跳转到指定时间
     */
    seek(time) {
        this.currentTime = time * 1000; // 转换为毫秒
        this.getFrame(this.currentTime);
    }

    /**
     * 清除缓冲区
     */
    clearBuffer() {
        this.frameBuffer = [];
        this.audioBuffer = [];
        
        if (this.options.enableWorker && this.worker) {
            this.worker.postMessage({ type: 'clear' });
        }
    }

    /**
     * 销毁解码器
     */
    destroy() {
        this.pause();
        this.clearBuffer();
        
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        this.canvas = null;
        this.ctx = null;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaVideoDecoder;
} else {
    window.TeslaVideoDecoder = TeslaVideoDecoder;
}