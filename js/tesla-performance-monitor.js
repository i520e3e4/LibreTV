/**
 * Tesla性能监控和优化工具
 * 实时监控播放性能，自动调整参数以获得最佳播放体验
 */

class TeslaPerformanceMonitor {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.monitoringInterval = options.monitoringInterval || 1000; // 1秒
        this.optimizationInterval = options.optimizationInterval || 10000; // 10秒
        
        // 性能指标
        this.metrics = {
            // 网络性能
            bandwidth: {
                current: 0,
                average: 0,
                peak: 0,
                history: []
            },
            
            // 播放性能
            playback: {
                fps: 0,
                droppedFrames: 0,
                buffering: {
                    events: 0,
                    totalTime: 0,
                    currentLevel: 0
                },
                latency: 0,
                quality: {
                    resolution: { width: 0, height: 0 },
                    bitrate: 0
                }
            },
            
            // 系统性能
            system: {
                cpu: 0,
                memory: 0,
                gpu: 0,
                temperature: 0
            },
            
            // 用户体验
            experience: {
                startupTime: 0,
                seekTime: 0,
                errorRate: 0,
                qualityChanges: 0,
                userSatisfaction: 0
            }
        };
        
        // 优化配置
        this.optimizationConfig = {
            // 自适应比特率
            adaptiveBitrate: {
                enabled: true,
                minBitrate: 500000, // 500 Kbps
                maxBitrate: 10000000, // 10 Mbps
                stepSize: 0.2, // 20%调整
                bufferThreshold: 3 // 3秒缓冲
            },
            
            // 分辨率调整
            adaptiveResolution: {
                enabled: true,
                minResolution: { width: 640, height: 360 },
                maxResolution: { width: 1920, height: 1080 },
                cpuThreshold: 80, // CPU使用率阈值
                fpsThreshold: 24 // 最低FPS阈值
            },
            
            // 缓冲优化
            bufferOptimization: {
                enabled: true,
                targetBuffer: 5, // 目标缓冲时间（秒）
                maxBuffer: 30, // 最大缓冲时间（秒）
                rebufferThreshold: 1 // 重新缓冲阈值（秒）
            },
            
            // 网络优化
            networkOptimization: {
                enabled: true,
                congestionDetection: true,
                adaptiveChunking: true,
                parallelDownloads: 2
            }
        };
        
        // 监控状态
        this.isMonitoring = false;
        this.monitoringTimer = null;
        this.optimizationTimer = null;
        
        // 回调函数
        this.onMetricsUpdate = options.onMetricsUpdate || (() => {});
        this.onOptimizationApplied = options.onOptimizationApplied || (() => {});
        this.onPerformanceAlert = options.onPerformanceAlert || (() => {});
        
        // 性能阈值
        this.thresholds = {
            lowBandwidth: 1000000, // 1 Mbps
            highLatency: 200, // 200ms
            lowFps: 20,
            highCpu: 80,
            highMemory: 80,
            maxBuffering: 5000 // 5秒
        };
        
        this.log('Tesla性能监控器初始化完成');
    }
    
    /**
     * 开始监控
     */
    startMonitoring(videoElement, player) {
        if (this.isMonitoring) {
            this.log('监控已在运行中');
            return;
        }
        
        this.videoElement = videoElement;
        this.player = player;
        this.isMonitoring = true;
        
        // 开始性能监控
        this.monitoringTimer = setInterval(() => {
            this.collectMetrics();
        }, this.monitoringInterval);
        
        // 开始优化调整
        this.optimizationTimer = setInterval(() => {
            this.performOptimization();
        }, this.optimizationInterval);
        
        // 监听视频事件
        this.attachVideoEventListeners();
        
        this.log('性能监控已开始');
    }
    
    /**
     * 停止监控
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
            this.optimizationTimer = null;
        }
        
        this.detachVideoEventListeners();
        
        this.log('性能监控已停止');
    }
    
    /**
     * 收集性能指标
     */
    collectMetrics() {
        try {
            // 收集网络性能
            this.collectNetworkMetrics();
            
            // 收集播放性能
            this.collectPlaybackMetrics();
            
            // 收集系统性能
            this.collectSystemMetrics();
            
            // 更新用户体验指标
            this.updateExperienceMetrics();
            
            // 检查性能警告
            this.checkPerformanceAlerts();
            
            // 通知更新
            this.onMetricsUpdate(this.metrics);
            
        } catch (error) {
            this.log('收集性能指标时出错:', error);
        }
    }
    
    /**
     * 收集网络性能指标
     */
    collectNetworkMetrics() {
        // 使用Navigation Timing API
        if (performance.getEntriesByType) {
            const entries = performance.getEntriesByType('navigation');
            if (entries.length > 0) {
                const entry = entries[0];
                this.metrics.bandwidth.current = this.estimateBandwidth(entry);
            }
        }
        
        // 使用Network Information API
        if (navigator.connection) {
            const connection = navigator.connection;
            if (connection.downlink) {
                this.metrics.bandwidth.current = connection.downlink * 1000000; // 转换为bps
            }
        }
        
        // 更新带宽历史
        this.metrics.bandwidth.history.push({
            value: this.metrics.bandwidth.current,
            timestamp: Date.now()
        });
        
        // 限制历史记录长度
        if (this.metrics.bandwidth.history.length > 60) {
            this.metrics.bandwidth.history.shift();
        }
        
        // 计算平均值和峰值
        const recentValues = this.metrics.bandwidth.history.slice(-10).map(item => item.value);
        this.metrics.bandwidth.average = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
        this.metrics.bandwidth.peak = Math.max(...recentValues);
    }
    
    /**
     * 收集播放性能指标
     */
    collectPlaybackMetrics() {
        if (!this.videoElement) return;
        
        // FPS和丢帧
        if (this.videoElement.getVideoPlaybackQuality) {
            const quality = this.videoElement.getVideoPlaybackQuality();
            this.metrics.playback.droppedFrames = quality.droppedVideoFrames;
            
            // 计算FPS
            const now = performance.now();
            if (this.lastFrameCheck) {
                const timeDiff = (now - this.lastFrameCheck) / 1000;
                const frameDiff = quality.totalVideoFrames - (this.lastFrameCount || 0);
                this.metrics.playback.fps = frameDiff / timeDiff;
            }
            this.lastFrameCheck = now;
            this.lastFrameCount = quality.totalVideoFrames;
        }
        
        // 缓冲状态
        if (this.videoElement.buffered && this.videoElement.buffered.length > 0) {
            const currentTime = this.videoElement.currentTime;
            const bufferedEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
            this.metrics.playback.buffering.currentLevel = bufferedEnd - currentTime;
        }
        
        // 视频质量
        this.metrics.playback.quality.resolution.width = this.videoElement.videoWidth;
        this.metrics.playback.quality.resolution.height = this.videoElement.videoHeight;
        
        // 如果有播放器API，获取更多信息
        if (this.player && typeof this.player.getStats === 'function') {
            const stats = this.player.getStats();
            if (stats) {
                this.metrics.playback.quality.bitrate = stats.bitrate || 0;
                this.metrics.playback.latency = stats.latency || 0;
            }
        }
    }
    
    /**
     * 收集系统性能指标
     */
    collectSystemMetrics() {
        // 内存使用情况
        if (performance.memory) {
            const memory = performance.memory;
            this.metrics.system.memory = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        }
        
        // CPU使用情况（估算）
        this.estimateCpuUsage();
        
        // GPU使用情况（如果可用）
        this.estimateGpuUsage();
    }
    
    /**
     * 估算CPU使用率
     */
    estimateCpuUsage() {
        const start = performance.now();
        const iterations = 100000;
        
        // 执行一些计算密集型操作
        for (let i = 0; i < iterations; i++) {
            Math.random();
        }
        
        const end = performance.now();
        const executionTime = end - start;
        
        // 基于执行时间估算CPU负载
        // 这是一个简化的估算方法
        const baselineTime = 10; // 基准时间（毫秒）
        this.metrics.system.cpu = Math.min(100, (executionTime / baselineTime) * 100);
    }
    
    /**
     * 估算GPU使用率
     */
    estimateGpuUsage() {
        // 这是一个简化的GPU使用率估算
        // 实际应用中可能需要更复杂的方法
        if (this.videoElement) {
            const resolution = this.videoElement.videoWidth * this.videoElement.videoHeight;
            const fps = this.metrics.playback.fps;
            
            // 基于分辨率和帧率估算GPU负载
            const pixelsPerSecond = resolution * fps;
            const maxPixelsPerSecond = 1920 * 1080 * 60; // 假设的最大处理能力
            
            this.metrics.system.gpu = Math.min(100, (pixelsPerSecond / maxPixelsPerSecond) * 100);
        }
    }
    
    /**
     * 更新用户体验指标
     */
    updateExperienceMetrics() {
        // 计算用户满意度分数
        let satisfaction = 100;
        
        // 基于各种因素调整满意度
        if (this.metrics.playback.fps < this.thresholds.lowFps) {
            satisfaction -= 20;
        }
        
        if (this.metrics.bandwidth.current < this.thresholds.lowBandwidth) {
            satisfaction -= 15;
        }
        
        if (this.metrics.playback.latency > this.thresholds.highLatency) {
            satisfaction -= 10;
        }
        
        if (this.metrics.playback.buffering.totalTime > this.thresholds.maxBuffering) {
            satisfaction -= 25;
        }
        
        this.metrics.experience.userSatisfaction = Math.max(0, satisfaction);
    }
    
    /**
     * 检查性能警告
     */
    checkPerformanceAlerts() {
        const alerts = [];
        
        // 检查低带宽
        if (this.metrics.bandwidth.current < this.thresholds.lowBandwidth) {
            alerts.push({
                type: 'warning',
                category: 'network',
                message: '网络带宽较低，可能影响播放质量',
                value: this.metrics.bandwidth.current,
                threshold: this.thresholds.lowBandwidth
            });
        }
        
        // 检查低帧率
        if (this.metrics.playback.fps < this.thresholds.lowFps) {
            alerts.push({
                type: 'warning',
                category: 'playback',
                message: '播放帧率过低',
                value: this.metrics.playback.fps,
                threshold: this.thresholds.lowFps
            });
        }
        
        // 检查高CPU使用率
        if (this.metrics.system.cpu > this.thresholds.highCpu) {
            alerts.push({
                type: 'warning',
                category: 'system',
                message: 'CPU使用率过高',
                value: this.metrics.system.cpu,
                threshold: this.thresholds.highCpu
            });
        }
        
        // 检查高内存使用率
        if (this.metrics.system.memory > this.thresholds.highMemory) {
            alerts.push({
                type: 'warning',
                category: 'system',
                message: '内存使用率过高',
                value: this.metrics.system.memory,
                threshold: this.thresholds.highMemory
            });
        }
        
        // 发送警告
        if (alerts.length > 0) {
            this.onPerformanceAlert(alerts);
        }
    }
    
    /**
     * 执行性能优化
     */
    performOptimization() {
        const optimizations = [];
        
        try {
            // 自适应比特率优化
            if (this.optimizationConfig.adaptiveBitrate.enabled) {
                const bitrateOptimization = this.optimizeBitrate();
                if (bitrateOptimization) {
                    optimizations.push(bitrateOptimization);
                }
            }
            
            // 自适应分辨率优化
            if (this.optimizationConfig.adaptiveResolution.enabled) {
                const resolutionOptimization = this.optimizeResolution();
                if (resolutionOptimization) {
                    optimizations.push(resolutionOptimization);
                }
            }
            
            // 缓冲优化
            if (this.optimizationConfig.bufferOptimization.enabled) {
                const bufferOptimization = this.optimizeBuffer();
                if (bufferOptimization) {
                    optimizations.push(bufferOptimization);
                }
            }
            
            // 应用优化
            if (optimizations.length > 0) {
                this.applyOptimizations(optimizations);
                this.onOptimizationApplied(optimizations);
            }
            
        } catch (error) {
            this.log('执行性能优化时出错:', error);
        }
    }
    
    /**
     * 优化比特率
     */
    optimizeBitrate() {
        const config = this.optimizationConfig.adaptiveBitrate;
        const currentBitrate = this.metrics.playback.quality.bitrate;
        const bandwidth = this.metrics.bandwidth.current;
        const bufferLevel = this.metrics.playback.buffering.currentLevel;
        
        let targetBitrate = currentBitrate;
        
        // 如果缓冲不足，降低比特率
        if (bufferLevel < config.bufferThreshold) {
            targetBitrate = Math.max(config.minBitrate, currentBitrate * (1 - config.stepSize));
        }
        // 如果带宽充足且缓冲充足，提高比特率
        else if (bandwidth > currentBitrate * 1.5 && bufferLevel > config.bufferThreshold * 2) {
            targetBitrate = Math.min(config.maxBitrate, currentBitrate * (1 + config.stepSize));
        }
        
        if (Math.abs(targetBitrate - currentBitrate) > currentBitrate * 0.1) {
            return {
                type: 'bitrate',
                from: currentBitrate,
                to: targetBitrate,
                reason: bufferLevel < config.bufferThreshold ? 'low_buffer' : 'high_bandwidth'
            };
        }
        
        return null;
    }
    
    /**
     * 优化分辨率
     */
    optimizeResolution() {
        const config = this.optimizationConfig.adaptiveResolution;
        const currentResolution = this.metrics.playback.quality.resolution;
        const fps = this.metrics.playback.fps;
        const cpuUsage = this.metrics.system.cpu;
        
        let targetResolution = currentResolution;
        
        // 如果FPS过低或CPU使用率过高，降低分辨率
        if (fps < config.fpsThreshold || cpuUsage > config.cpuThreshold) {
            const scale = 0.8;
            targetResolution = {
                width: Math.max(config.minResolution.width, Math.floor(currentResolution.width * scale)),
                height: Math.max(config.minResolution.height, Math.floor(currentResolution.height * scale))
            };
        }
        // 如果性能良好，可以提高分辨率
        else if (fps > config.fpsThreshold * 1.2 && cpuUsage < config.cpuThreshold * 0.7) {
            const scale = 1.2;
            targetResolution = {
                width: Math.min(config.maxResolution.width, Math.floor(currentResolution.width * scale)),
                height: Math.min(config.maxResolution.height, Math.floor(currentResolution.height * scale))
            };
        }
        
        if (targetResolution.width !== currentResolution.width || 
            targetResolution.height !== currentResolution.height) {
            return {
                type: 'resolution',
                from: currentResolution,
                to: targetResolution,
                reason: fps < config.fpsThreshold ? 'low_fps' : 'high_cpu'
            };
        }
        
        return null;
    }
    
    /**
     * 优化缓冲
     */
    optimizeBuffer() {
        const config = this.optimizationConfig.bufferOptimization;
        const currentBuffer = this.metrics.playback.buffering.currentLevel;
        const bandwidth = this.metrics.bandwidth.current;
        
        let targetBuffer = config.targetBuffer;
        
        // 根据带宽调整目标缓冲
        if (bandwidth < this.thresholds.lowBandwidth) {
            targetBuffer = Math.min(config.maxBuffer, config.targetBuffer * 1.5);
        } else if (bandwidth > this.thresholds.lowBandwidth * 3) {
            targetBuffer = Math.max(config.rebufferThreshold, config.targetBuffer * 0.8);
        }
        
        if (Math.abs(targetBuffer - currentBuffer) > 1) {
            return {
                type: 'buffer',
                from: currentBuffer,
                to: targetBuffer,
                reason: bandwidth < this.thresholds.lowBandwidth ? 'low_bandwidth' : 'high_bandwidth'
            };
        }
        
        return null;
    }
    
    /**
     * 应用优化
     */
    applyOptimizations(optimizations) {
        for (const optimization of optimizations) {
            try {
                switch (optimization.type) {
                    case 'bitrate':
                        this.applyBitrateOptimization(optimization);
                        break;
                    case 'resolution':
                        this.applyResolutionOptimization(optimization);
                        break;
                    case 'buffer':
                        this.applyBufferOptimization(optimization);
                        break;
                }
                
                this.log(`应用优化: ${optimization.type}`, optimization);
                
            } catch (error) {
                this.log(`应用优化失败: ${optimization.type}`, error);
            }
        }
    }
    
    /**
     * 应用比特率优化
     */
    applyBitrateOptimization(optimization) {
        if (this.player && typeof this.player.setBitrate === 'function') {
            this.player.setBitrate(optimization.to);
        }
    }
    
    /**
     * 应用分辨率优化
     */
    applyResolutionOptimization(optimization) {
        if (this.player && typeof this.player.setResolution === 'function') {
            this.player.setResolution(optimization.to.width, optimization.to.height);
        }
    }
    
    /**
     * 应用缓冲优化
     */
    applyBufferOptimization(optimization) {
        if (this.player && typeof this.player.setBufferTarget === 'function') {
            this.player.setBufferTarget(optimization.to);
        }
    }
    
    /**
     * 附加视频事件监听器
     */
    attachVideoEventListeners() {
        if (!this.videoElement) return;
        
        // 缓冲事件
        this.videoElement.addEventListener('waiting', () => {
            this.metrics.playback.buffering.events++;
            this.bufferingStartTime = Date.now();
        });
        
        this.videoElement.addEventListener('canplay', () => {
            if (this.bufferingStartTime) {
                this.metrics.playback.buffering.totalTime += Date.now() - this.bufferingStartTime;
                this.bufferingStartTime = null;
            }
        });
        
        // 错误事件
        this.videoElement.addEventListener('error', () => {
            this.metrics.experience.errorRate++;
        });
        
        // 质量变化事件
        this.videoElement.addEventListener('resize', () => {
            this.metrics.experience.qualityChanges++;
        });
    }
    
    /**
     * 分离视频事件监听器
     */
    detachVideoEventListeners() {
        // 这里应该移除所有事件监听器
        // 为了简化，这里省略具体实现
    }
    
    /**
     * 估算带宽
     */
    estimateBandwidth(entry) {
        if (!entry) return 0;
        
        const transferSize = entry.transferSize || 0;
        const duration = entry.responseEnd - entry.requestStart;
        
        if (duration > 0) {
            return (transferSize * 8) / (duration / 1000); // bps
        }
        
        return 0;
    }
    
    /**
     * 获取性能报告
     */
    getPerformanceReport() {
        return {
            timestamp: Date.now(),
            metrics: JSON.parse(JSON.stringify(this.metrics)),
            optimizationConfig: this.optimizationConfig,
            isMonitoring: this.isMonitoring,
            summary: {
                overallScore: this.calculateOverallScore(),
                recommendations: this.generateRecommendations()
            }
        };
    }
    
    /**
     * 计算总体性能分数
     */
    calculateOverallScore() {
        let score = 100;
        
        // 网络分数 (30%)
        const networkScore = Math.min(100, (this.metrics.bandwidth.current / this.thresholds.lowBandwidth) * 100);
        score = score * 0.7 + networkScore * 0.3;
        
        // 播放分数 (40%)
        const playbackScore = Math.min(100, (this.metrics.playback.fps / 30) * 100);
        score = score * 0.6 + playbackScore * 0.4;
        
        // 系统分数 (20%)
        const systemScore = 100 - Math.max(this.metrics.system.cpu, this.metrics.system.memory);
        score = score * 0.8 + systemScore * 0.2;
        
        // 用户体验分数 (10%)
        score = score * 0.9 + this.metrics.experience.userSatisfaction * 0.1;
        
        return Math.round(score);
    }
    
    /**
     * 生成优化建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.bandwidth.current < this.thresholds.lowBandwidth) {
            recommendations.push('建议降低视频质量以适应当前网络带宽');
        }
        
        if (this.metrics.playback.fps < this.thresholds.lowFps) {
            recommendations.push('建议降低分辨率或关闭其他应用程序以提高帧率');
        }
        
        if (this.metrics.system.cpu > this.thresholds.highCpu) {
            recommendations.push('建议关闭其他应用程序以降低CPU使用率');
        }
        
        if (this.metrics.playback.buffering.events > 5) {
            recommendations.push('建议增加缓冲时间或检查网络连接');
        }
        
        return recommendations;
    }
    
    /**
     * 重置性能指标
     */
    resetMetrics() {
        this.metrics = {
            bandwidth: { current: 0, average: 0, peak: 0, history: [] },
            playback: {
                fps: 0,
                droppedFrames: 0,
                buffering: { events: 0, totalTime: 0, currentLevel: 0 },
                latency: 0,
                quality: { resolution: { width: 0, height: 0 }, bitrate: 0 }
            },
            system: { cpu: 0, memory: 0, gpu: 0, temperature: 0 },
            experience: {
                startupTime: 0,
                seekTime: 0,
                errorRate: 0,
                qualityChanges: 0,
                userSatisfaction: 0
            }
        };
        
        this.log('性能指标已重置');
    }
    
    /**
     * 日志输出
     */
    log(message, data = null) {
        if (this.debug) {
            const timestamp = new Date().toISOString();
            if (data) {
                console.log(`[Tesla Performance Monitor] ${timestamp}`, message, data);
            } else {
                console.log(`[Tesla Performance Monitor] ${timestamp}`, message);
            }
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaPerformanceMonitor;
} else if (typeof window !== 'undefined') {
    window.TeslaPerformanceMonitor = TeslaPerformanceMonitor;
}