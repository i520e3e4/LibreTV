/**
 * Tesla智能降级管理器
 * 根据网络状况、设备能力和错误情况自动选择最佳播放方案
 */

class TeslaFallbackManager {
    constructor(options = {}) {
        this.config = options.config || {};
        this.debug = options.debug || false;
        
        // 播放方案配置
        this.methods = [
            {
                name: 'webrtc',
                priority: 1,
                timeout: 10000,
                retries: 2,
                requirements: ['webrtc_support', 'websocket_support'],
                description: 'WebRTC实时流媒体'
            },
            {
                name: 'proxy',
                priority: 2,
                timeout: 15000,
                retries: 3,
                requirements: ['proxy_server'],
                description: '代理服务器播放'
            },
            {
                name: 'transcode',
                priority: 3,
                timeout: 30000,
                retries: 2,
                requirements: ['proxy_server', 'ffmpeg_support'],
                description: '转码播放'
            },
            {
                name: 'direct',
                priority: 4,
                timeout: 20000,
                retries: 1,
                requirements: [],
                description: '直接播放'
            }
        ];
        
        // 当前状态
        this.currentMethod = null;
        this.attemptHistory = [];
        this.networkInfo = null;
        this.deviceInfo = null;
        
        // 性能监控
        this.metrics = {
            connectionTime: [],
            firstFrameTime: [],
            errorRate: 0,
            bandwidthUsage: [],
            successRate: {}
        };
        
        // 回调函数
        this.onMethodSelected = options.onMethodSelected || (() => {});
        this.onMethodFailed = options.onMethodFailed || (() => {});
        this.onFallbackComplete = options.onFallbackComplete || (() => {});
        this.onMetricsUpdate = options.onMetricsUpdate || (() => {});
        
        this.log('Tesla智能降级管理器初始化完成');
        this.initializeCapabilityDetection();
    }
    
    /**
     * 初始化能力检测
     */
    async initializeCapabilityDetection() {
        try {
            // 检测设备能力
            this.deviceInfo = await this.detectDeviceCapabilities();
            
            // 检测网络状况
            this.networkInfo = await this.detectNetworkCapabilities();
            
            // 检测各种播放方案的可用性
            await this.detectMethodAvailability();
            
            this.log('能力检测完成', {
                device: this.deviceInfo,
                network: this.networkInfo
            });
            
        } catch (error) {
            this.log('能力检测失败:', error);
        }
    }
    
    /**
     * 检测设备能力
     */
    async detectDeviceCapabilities() {
        const capabilities = {
            webrtc_support: false,
            websocket_support: false,
            hardware_acceleration: false,
            supported_codecs: [],
            max_resolution: { width: 1920, height: 1080 },
            memory_limit: null,
            cpu_cores: navigator.hardwareConcurrency || 4
        };
        
        // 检测WebRTC支持
        capabilities.webrtc_support = !!(window.RTCPeerConnection && 
            navigator.mediaDevices && 
            navigator.mediaDevices.getUserMedia);
        
        // 检测WebSocket支持
        capabilities.websocket_support = !!window.WebSocket;
        
        // 检测硬件加速
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            capabilities.hardware_acceleration = !!gl;
        } catch (e) {
            capabilities.hardware_acceleration = false;
        }
        
        // 检测支持的编解码器
        const video = document.createElement('video');
        const codecs = ['video/mp4; codecs="avc1.42E01E"', 'video/webm; codecs="vp8"', 'video/webm; codecs="vp9"'];
        
        codecs.forEach(codec => {
            if (video.canPlayType(codec) === 'probably' || video.canPlayType(codec) === 'maybe') {
                capabilities.supported_codecs.push(codec);
            }
        });
        
        // 检测内存限制
        if ('memory' in performance) {
            capabilities.memory_limit = performance.memory.jsHeapSizeLimit;
        }
        
        return capabilities;
    }
    
    /**
     * 检测网络能力
     */
    async detectNetworkCapabilities() {
        const networkInfo = {
            connection_type: 'unknown',
            effective_type: 'unknown',
            downlink: null,
            rtt: null,
            bandwidth_estimate: null,
            is_mobile: false
        };
        
        // 使用Network Information API
        if ('connection' in navigator) {
            const connection = navigator.connection;
            networkInfo.connection_type = connection.type || 'unknown';
            networkInfo.effective_type = connection.effectiveType || 'unknown';
            networkInfo.downlink = connection.downlink;
            networkInfo.rtt = connection.rtt;
        }
        
        // 检测是否为移动设备
        networkInfo.is_mobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // 进行带宽测试
        try {
            networkInfo.bandwidth_estimate = await this.estimateBandwidth();
        } catch (error) {
            this.log('带宽测试失败:', error);
        }
        
        return networkInfo;
    }
    
    /**
     * 估算带宽
     */
    async estimateBandwidth() {
        const testUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A';
        const testSize = 1024; // 1KB
        
        const startTime = performance.now();
        
        try {
            const response = await fetch(testUrl);
            await response.blob();
            const endTime = performance.now();
            
            const duration = (endTime - startTime) / 1000; // 转换为秒
            const bandwidth = (testSize * 8) / duration; // bps
            
            return bandwidth;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * 检测播放方案可用性
     */
    async detectMethodAvailability() {
        for (const method of this.methods) {
            method.available = await this.checkMethodRequirements(method);
            this.log(`播放方案 ${method.name}: ${method.available ? '可用' : '不可用'}`);
        }
    }
    
    /**
     * 检查播放方案要求
     */
    async checkMethodRequirements(method) {
        for (const requirement of method.requirements) {
            switch (requirement) {
                case 'webrtc_support':
                    if (!this.deviceInfo?.webrtc_support) return false;
                    break;
                case 'websocket_support':
                    if (!this.deviceInfo?.websocket_support) return false;
                    break;
                case 'proxy_server':
                    // 这里应该检查代理服务器是否可用
                    // 暂时返回true，实际应用中需要ping代理服务器
                    break;
                case 'ffmpeg_support':
                    // 检查服务器端FFmpeg支持
                    break;
            }
        }
        return true;
    }
    
    /**
     * 选择最佳播放方案
     */
    async selectBestMethod(videoUrl, options = {}) {
        this.log('开始选择最佳播放方案', { videoUrl, options });
        
        // 根据网络状况和设备能力过滤方案
        const availableMethods = this.methods
            .filter(method => method.available)
            .sort((a, b) => a.priority - b.priority);
        
        if (availableMethods.length === 0) {
            throw new Error('没有可用的播放方案');
        }
        
        // 根据网络状况调整优先级
        const optimizedMethods = this.optimizeMethodsByNetwork(availableMethods);
        
        // 根据历史成功率调整
        const finalMethods = this.optimizeMethodsByHistory(optimizedMethods);
        
        const selectedMethod = finalMethods[0];
        this.currentMethod = selectedMethod;
        
        this.log('选择播放方案:', selectedMethod);
        this.onMethodSelected(selectedMethod);
        
        return selectedMethod;
    }
    
    /**
     * 根据网络状况优化方案
     */
    optimizeMethodsByNetwork(methods) {
        if (!this.networkInfo) return methods;
        
        const networkSpeed = this.getNetworkSpeedCategory();
        
        return methods.map(method => {
            const optimizedMethod = { ...method };
            
            // 根据网络速度调整超时时间
            switch (networkSpeed) {
                case 'slow':
                    optimizedMethod.timeout *= 2;
                    optimizedMethod.retries += 1;
                    break;
                case 'medium':
                    optimizedMethod.timeout *= 1.5;
                    break;
                case 'fast':
                    optimizedMethod.timeout *= 0.8;
                    break;
            }
            
            return optimizedMethod;
        }).sort((a, b) => {
            // 在慢网络下，优先选择更轻量的方案
            if (networkSpeed === 'slow') {
                const lightweightOrder = ['direct', 'proxy', 'transcode', 'webrtc'];
                return lightweightOrder.indexOf(a.name) - lightweightOrder.indexOf(b.name);
            }
            
            return a.priority - b.priority;
        });
    }
    
    /**
     * 根据历史成功率优化方案
     */
    optimizeMethodsByHistory(methods) {
        return methods.sort((a, b) => {
            const aSuccessRate = this.metrics.successRate[a.name] || 0.5;
            const bSuccessRate = this.metrics.successRate[b.name] || 0.5;
            
            // 结合优先级和成功率
            const aScore = (aSuccessRate * 0.7) + ((5 - a.priority) * 0.3);
            const bScore = (bSuccessRate * 0.7) + ((5 - b.priority) * 0.3);
            
            return bScore - aScore;
        });
    }
    
    /**
     * 获取网络速度分类
     */
    getNetworkSpeedCategory() {
        if (!this.networkInfo) return 'unknown';
        
        const { effective_type, downlink, bandwidth_estimate } = this.networkInfo;
        
        // 基于effective_type
        if (effective_type) {
            switch (effective_type) {
                case 'slow-2g':
                case '2g':
                    return 'slow';
                case '3g':
                    return 'medium';
                case '4g':
                    return 'fast';
            }
        }
        
        // 基于downlink
        if (downlink) {
            if (downlink < 1) return 'slow';
            if (downlink < 10) return 'medium';
            return 'fast';
        }
        
        // 基于带宽估算
        if (bandwidth_estimate) {
            if (bandwidth_estimate < 1000000) return 'slow'; // < 1 Mbps
            if (bandwidth_estimate < 10000000) return 'medium'; // < 10 Mbps
            return 'fast';
        }
        
        return 'medium';
    }
    
    /**
     * 执行降级策略
     */
    async executeWithFallback(videoUrl, playFunction, options = {}) {
        const startTime = performance.now();
        let lastError = null;
        
        // 选择最佳方案
        const selectedMethod = await this.selectBestMethod(videoUrl, options);
        const methodsToTry = this.methods
            .filter(method => method.available)
            .sort((a, b) => {
                if (a.name === selectedMethod.name) return -1;
                if (b.name === selectedMethod.name) return 1;
                return a.priority - b.priority;
            });
        
        for (const method of methodsToTry) {
            this.log(`尝试播放方案: ${method.name}`);
            
            for (let attempt = 0; attempt < method.retries; attempt++) {
                try {
                    const attemptStartTime = performance.now();
                    
                    // 设置超时
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('播放超时')), method.timeout);
                    });
                    
                    // 执行播放
                    const playPromise = playFunction(method, videoUrl, options);
                    
                    const result = await Promise.race([playPromise, timeoutPromise]);
                    
                    // 记录成功
                    const attemptTime = performance.now() - attemptStartTime;
                    this.recordSuccess(method, attemptTime);
                    
                    this.log(`播放方案 ${method.name} 成功`, { attemptTime });
                    this.onFallbackComplete({ method, success: true, attemptTime });
                    
                    return result;
                    
                } catch (error) {
                    lastError = error;
                    const attemptTime = performance.now() - attemptStartTime;
                    
                    this.log(`播放方案 ${method.name} 失败 (尝试 ${attempt + 1}/${method.retries}):`, error);
                    this.recordFailure(method, error, attemptTime);
                    this.onMethodFailed({ method, error, attempt: attempt + 1 });
                    
                    // 如果不是最后一次尝试，等待一段时间再重试
                    if (attempt < method.retries - 1) {
                        await this.delay(1000 * (attempt + 1));
                    }
                }
            }
        }
        
        // 所有方案都失败了
        const totalTime = performance.now() - startTime;
        this.log('所有播放方案都失败了', { totalTime, lastError });
        this.onFallbackComplete({ method: null, success: false, totalTime, error: lastError });
        
        throw new Error(`所有播放方案都失败了: ${lastError?.message || '未知错误'}`);
    }
    
    /**
     * 记录成功
     */
    recordSuccess(method, time) {
        // 更新成功率
        if (!this.metrics.successRate[method.name]) {
            this.metrics.successRate[method.name] = 0.5;
        }
        this.metrics.successRate[method.name] = Math.min(1, this.metrics.successRate[method.name] + 0.1);
        
        // 记录连接时间
        this.metrics.connectionTime.push({ method: method.name, time, timestamp: Date.now() });
        
        // 限制历史记录长度
        if (this.metrics.connectionTime.length > 100) {
            this.metrics.connectionTime.shift();
        }
        
        this.updateMetrics();
    }
    
    /**
     * 记录失败
     */
    recordFailure(method, error, time) {
        // 更新成功率
        if (!this.metrics.successRate[method.name]) {
            this.metrics.successRate[method.name] = 0.5;
        }
        this.metrics.successRate[method.name] = Math.max(0, this.metrics.successRate[method.name] - 0.1);
        
        // 记录错误
        this.attemptHistory.push({
            method: method.name,
            success: false,
            error: error.message,
            time,
            timestamp: Date.now()
        });
        
        // 限制历史记录长度
        if (this.attemptHistory.length > 50) {
            this.attemptHistory.shift();
        }
        
        this.updateMetrics();
    }
    
    /**
     * 更新性能指标
     */
    updateMetrics() {
        // 计算错误率
        const recentAttempts = this.attemptHistory.slice(-20);
        const failures = recentAttempts.filter(attempt => !attempt.success).length;
        this.metrics.errorRate = recentAttempts.length > 0 ? failures / recentAttempts.length : 0;
        
        this.onMetricsUpdate(this.metrics);
    }
    
    /**
     * 获取性能报告
     */
    getPerformanceReport() {
        return {
            currentMethod: this.currentMethod,
            deviceInfo: this.deviceInfo,
            networkInfo: this.networkInfo,
            metrics: this.metrics,
            attemptHistory: this.attemptHistory.slice(-10), // 最近10次尝试
            methodAvailability: this.methods.map(method => ({
                name: method.name,
                available: method.available,
                successRate: this.metrics.successRate[method.name] || 0
            }))
        };
    }
    
    /**
     * 重置统计信息
     */
    resetMetrics() {
        this.metrics = {
            connectionTime: [],
            firstFrameTime: [],
            errorRate: 0,
            bandwidthUsage: [],
            successRate: {}
        };
        this.attemptHistory = [];
        this.log('性能统计信息已重置');
    }
    
    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 日志输出
     */
    log(message, data = null) {
        if (this.debug) {
            const timestamp = new Date().toISOString();
            if (data) {
                console.log(`[Tesla Fallback Manager] ${timestamp}`, message, data);
            } else {
                console.log(`[Tesla Fallback Manager] ${timestamp}`, message);
            }
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaFallbackManager;
} else if (typeof window !== 'undefined') {
    window.TeslaFallbackManager = TeslaFallbackManager;
}