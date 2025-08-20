/**
 * 特斯拉播放器性能优化模块
 * 用于优化Canvas渲染、内存管理和播放性能
 */

class TeslaPerformanceOptimizer {
    constructor() {
        this.frameRateTarget = 30; // 目标帧率
        this.memoryThreshold = 100 * 1024 * 1024; // 100MB内存阈值
        this.bufferSize = 30; // 缓冲区大小
        this.qualityLevel = 'auto'; // 画质等级
        
        this.performanceMetrics = {
            fps: 0,
            frameDrops: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            renderTime: 0,
            decodeTime: 0
        };
        
        this.optimizationSettings = {
            enableFrameSkipping: true,
            enableMemoryOptimization: true,
            enableQualityAdaptation: true,
            enableBufferOptimization: true,
            enableGPUAcceleration: true
        };
        
        this.init();
    }
    
    /**
     * 初始化性能优化器
     */
    init() {
        this.detectHardwareCapabilities();
        this.setupPerformanceMonitoring();
        this.optimizeForTeslaHardware();
    }
    
    /**
     * 检测硬件能力
     */
    detectHardwareCapabilities() {
        // 检测GPU能力
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                console.log('GPU渲染器:', renderer);
                
                // 根据GPU类型调整设置
                if (renderer.includes('Tesla') || renderer.includes('NVIDIA')) {
                    this.optimizationSettings.enableGPUAcceleration = true;
                    this.frameRateTarget = 60;
                } else {
                    this.frameRateTarget = 30;
                }
            }
        }
        
        // 检测内存容量
        if (navigator.deviceMemory) {
            const memoryGB = navigator.deviceMemory;
            console.log('设备内存:', memoryGB + 'GB');
            
            if (memoryGB >= 8) {
                this.bufferSize = 60;
                this.qualityLevel = 'high';
            } else if (memoryGB >= 4) {
                this.bufferSize = 30;
                this.qualityLevel = 'medium';
            } else {
                this.bufferSize = 15;
                this.qualityLevel = 'low';
            }
        }
        
        // 检测CPU核心数
        if (navigator.hardwareConcurrency) {
            const cores = navigator.hardwareConcurrency;
            console.log('CPU核心数:', cores);
            
            if (cores >= 8) {
                this.optimizationSettings.enableFrameSkipping = false;
            }
        }
    }
    
    /**
     * 针对特斯拉硬件优化
     */
    optimizeForTeslaHardware() {
        // 特斯拉车机特定优化
        const userAgent = navigator.userAgent;
        
        if (userAgent.includes('Tesla') || userAgent.includes('QtCarBrowser')) {
            // 特斯拉车机优化设置
            this.frameRateTarget = 30; // 车机屏幕通常30fps足够
            this.bufferSize = 20; // 减少缓冲以节省内存
            this.optimizationSettings.enableMemoryOptimization = true;
            this.optimizationSettings.enableQualityAdaptation = true;
            
            // 检测特斯拉车型
            if (userAgent.includes('Model S') || userAgent.includes('Model X')) {
                // 高端车型，性能更好
                this.qualityLevel = 'high';
                this.frameRateTarget = 60;
            } else if (userAgent.includes('Model 3') || userAgent.includes('Model Y')) {
                // 标准车型
                this.qualityLevel = 'medium';
                this.frameRateTarget = 30;
            }
        }
    }
    
    /**
     * 设置性能监控
     */
    setupPerformanceMonitoring() {
        // 监控帧率
        this.frameCounter = 0;
        this.lastFrameTime = performance.now();
        
        // 监控内存使用
        if (performance.memory) {
            setInterval(() => {
                this.performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
                this.checkMemoryUsage();
            }, 5000);
        }
        
        // 监控渲染性能
        this.renderTimeHistory = [];
        this.decodeTimeHistory = [];
    }
    
    /**
     * 优化Canvas渲染
     */
    optimizeCanvasRendering(canvas, context) {
        if (!canvas || !context) return;
        
        // 设置最优的Canvas属性
        canvas.style.imageRendering = 'pixelated'; // 像素化渲染，减少抗锯齿计算
        
        // 优化2D上下文
        if (context.imageSmoothingEnabled !== undefined) {
            context.imageSmoothingEnabled = this.qualityLevel !== 'low';
        }
        
        // 设置合适的Canvas尺寸
        const devicePixelRatio = window.devicePixelRatio || 1;
        const scaleFactor = this.qualityLevel === 'high' ? devicePixelRatio : 
                           this.qualityLevel === 'medium' ? Math.min(devicePixelRatio, 2) : 1;
        
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        canvas.width = displayWidth * scaleFactor;
        canvas.height = displayHeight * scaleFactor;
        
        context.scale(scaleFactor, scaleFactor);
        
        return { scaleFactor, displayWidth, displayHeight };
    }
    
    /**
     * 优化WebGL渲染
     */
    optimizeWebGLRendering(gl) {
        if (!gl) return;
        
        // 启用深度测试优化
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        // 启用背面剔除
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        // 设置视口
        const canvas = gl.canvas;
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        // 优化纹理设置
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        
        // 根据质量等级设置纹理过滤
        const filterMode = this.qualityLevel === 'high' ? gl.LINEAR : gl.NEAREST;
        
        return { filterMode };
    }
    
    /**
     * 帧率控制
     */
    shouldSkipFrame() {
        if (!this.optimizationSettings.enableFrameSkipping) return false;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        const targetFrameTime = 1000 / this.frameRateTarget;
        
        // 如果距离上一帧时间太短，跳过这一帧
        if (deltaTime < targetFrameTime * 0.8) {
            return true;
        }
        
        this.lastFrameTime = currentTime;
        this.frameCounter++;
        
        // 计算实际帧率
        if (this.frameCounter % 30 === 0) {
            const fps = 30000 / (currentTime - this.fpsStartTime || currentTime);
            this.performanceMetrics.fps = fps;
            this.fpsStartTime = currentTime;
            
            // 动态调整帧率目标
            this.adaptFrameRate(fps);
        }
        
        return false;
    }
    
    /**
     * 动态调整帧率
     */
    adaptFrameRate(currentFps) {
        if (!this.optimizationSettings.enableQualityAdaptation) return;
        
        if (currentFps < this.frameRateTarget * 0.8) {
            // 帧率过低，降低质量
            if (this.qualityLevel === 'high') {
                this.qualityLevel = 'medium';
                console.log('性能优化: 降低画质到中等');
            } else if (this.qualityLevel === 'medium') {
                this.qualityLevel = 'low';
                console.log('性能优化: 降低画质到低等');
            }
        } else if (currentFps > this.frameRateTarget * 1.2) {
            // 帧率过高，可以提升质量
            if (this.qualityLevel === 'low') {
                this.qualityLevel = 'medium';
                console.log('性能优化: 提升画质到中等');
            } else if (this.qualityLevel === 'medium') {
                this.qualityLevel = 'high';
                console.log('性能优化: 提升画质到高等');
            }
        }
    }
    
    /**
     * 内存优化
     */
    optimizeMemoryUsage() {
        if (!this.optimizationSettings.enableMemoryOptimization) return;
        
        // 强制垃圾回收（如果可用）
        if (window.gc) {
            window.gc();
        }
        
        // 清理未使用的纹理和缓冲区
        this.cleanupUnusedResources();
        
        // 调整缓冲区大小
        if (this.performanceMetrics.memoryUsage > this.memoryThreshold) {
            this.bufferSize = Math.max(10, this.bufferSize - 5);
            console.log('内存优化: 减少缓冲区大小到', this.bufferSize);
        }
    }
    
    /**
     * 清理未使用的资源
     */
    cleanupUnusedResources() {
        // 清理Canvas缓存
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            if (canvas.style.display === 'none' || !canvas.parentNode) {
                const ctx = canvas.getContext('2d') || canvas.getContext('webgl');
                if (ctx && ctx.clearRect) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            }
        });
        
        // 清理音频缓存
        if (window.audioBufferCache) {
            const cacheKeys = Object.keys(window.audioBufferCache);
            if (cacheKeys.length > 10) {
                // 保留最近的10个音频缓冲
                cacheKeys.slice(0, -10).forEach(key => {
                    delete window.audioBufferCache[key];
                });
            }
        }
    }
    
    /**
     * 检查内存使用情况
     */
    checkMemoryUsage() {
        if (!performance.memory) return;
        
        const memoryUsage = performance.memory.usedJSHeapSize;
        const memoryLimit = performance.memory.jsHeapSizeLimit;
        const memoryPercent = (memoryUsage / memoryLimit) * 100;
        
        if (memoryPercent > 80) {
            console.warn('内存使用率过高:', memoryPercent.toFixed(1) + '%');
            this.optimizeMemoryUsage();
        }
    }
    
    /**
     * 优化视频解码
     */
    optimizeVideoDecoding(decoder) {
        if (!decoder) return;
        
        // 设置解码器参数
        const decoderConfig = {
            enableWorker: true,
            bufferSize: this.bufferSize,
            maxBufferLength: this.bufferSize * 2,
            enableHardwareAcceleration: this.optimizationSettings.enableGPUAcceleration
        };
        
        // 根据质量等级调整解码参数
        switch (this.qualityLevel) {
            case 'high':
                decoderConfig.targetBitrate = 5000000; // 5Mbps
                decoderConfig.maxWidth = 1920;
                decoderConfig.maxHeight = 1080;
                break;
            case 'medium':
                decoderConfig.targetBitrate = 2500000; // 2.5Mbps
                decoderConfig.maxWidth = 1280;
                decoderConfig.maxHeight = 720;
                break;
            case 'low':
                decoderConfig.targetBitrate = 1000000; // 1Mbps
                decoderConfig.maxWidth = 854;
                decoderConfig.maxHeight = 480;
                break;
        }
        
        return decoderConfig;
    }
    
    /**
     * 优化音频播放
     */
    optimizeAudioPlayback(audioContext) {
        if (!audioContext) return;
        
        // 设置音频上下文参数
        const sampleRate = audioContext.sampleRate;
        const bufferSize = Math.min(4096, Math.max(256, sampleRate / 60)); // 动态缓冲区大小
        
        // 创建压缩器以优化音频质量
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
        compressor.knee.setValueAtTime(30, audioContext.currentTime);
        compressor.ratio.setValueAtTime(12, audioContext.currentTime);
        compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
        compressor.release.setValueAtTime(0.25, audioContext.currentTime);
        
        return { bufferSize, compressor };
    }
    
    /**
     * 记录渲染时间
     */
    recordRenderTime(startTime, endTime) {
        const renderTime = endTime - startTime;
        this.renderTimeHistory.push(renderTime);
        
        // 保持历史记录在合理范围内
        if (this.renderTimeHistory.length > 100) {
            this.renderTimeHistory.shift();
        }
        
        // 计算平均渲染时间
        const avgRenderTime = this.renderTimeHistory.reduce((a, b) => a + b, 0) / this.renderTimeHistory.length;
        this.performanceMetrics.renderTime = avgRenderTime;
        
        // 如果渲染时间过长，触发优化
        if (avgRenderTime > 16.67) { // 超过60fps的帧时间
            this.triggerPerformanceOptimization();
        }
    }
    
    /**
     * 记录解码时间
     */
    recordDecodeTime(startTime, endTime) {
        const decodeTime = endTime - startTime;
        this.decodeTimeHistory.push(decodeTime);
        
        if (this.decodeTimeHistory.length > 100) {
            this.decodeTimeHistory.shift();
        }
        
        const avgDecodeTime = this.decodeTimeHistory.reduce((a, b) => a + b, 0) / this.decodeTimeHistory.length;
        this.performanceMetrics.decodeTime = avgDecodeTime;
    }
    
    /**
     * 触发性能优化
     */
    triggerPerformanceOptimization() {
        console.log('触发性能优化');
        
        // 降低质量等级
        if (this.qualityLevel === 'high') {
            this.qualityLevel = 'medium';
        } else if (this.qualityLevel === 'medium') {
            this.qualityLevel = 'low';
        }
        
        // 减少缓冲区大小
        this.bufferSize = Math.max(10, this.bufferSize - 5);
        
        // 启用帧跳过
        this.optimizationSettings.enableFrameSkipping = true;
        
        // 清理内存
        this.optimizeMemoryUsage();
    }
    
    /**
     * 获取性能指标
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            qualityLevel: this.qualityLevel,
            bufferSize: this.bufferSize,
            frameRateTarget: this.frameRateTarget
        };
    }
    
    /**
     * 获取优化建议
     */
    getOptimizationRecommendations() {
        const recommendations = [];
        
        if (this.performanceMetrics.fps < this.frameRateTarget * 0.8) {
            recommendations.push('帧率过低，建议降低画质或减少缓冲区大小');
        }
        
        if (this.performanceMetrics.memoryUsage > this.memoryThreshold) {
            recommendations.push('内存使用过高，建议清理缓存或减少缓冲区');
        }
        
        if (this.performanceMetrics.renderTime > 16.67) {
            recommendations.push('渲染时间过长，建议启用GPU加速或降低分辨率');
        }
        
        if (this.performanceMetrics.decodeTime > 10) {
            recommendations.push('解码时间过长，建议使用硬件解码或降低码率');
        }
        
        return recommendations;
    }
    
    /**
     * 销毁优化器
     */
    destroy() {
        // 清理定时器和事件监听器
        if (this.performanceMonitorInterval) {
            clearInterval(this.performanceMonitorInterval);
        }
        
        // 清理历史数据
        this.renderTimeHistory = [];
        this.decodeTimeHistory = [];
        
        console.log('性能优化器已销毁');
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaPerformanceOptimizer;
}