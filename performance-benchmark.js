/**
 * Tesla LibreTV 性能基准测试工具
 * 测试不同视频播放方案的性能表现
 */

class PerformanceBenchmark {
    constructor() {
        this.testResults = [];
        this.currentTest = null;
        this.testConfig = {
            // 测试视频配置
            testVideos: [
                {
                    name: '低质量测试视频',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    resolution: '480p',
                    duration: 30,
                    size: '5MB'
                },
                {
                    name: '中等质量测试视频',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                    resolution: '720p',
                    duration: 60,
                    size: '15MB'
                },
                {
                    name: '高质量测试视频',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                    resolution: '1080p',
                    duration: 120,
                    size: '30MB'
                }
            ],
            
            // 测试方案配置
            testMethods: [
                {
                    name: 'direct',
                    displayName: '直接播放',
                    description: '直接使用HTML5 video元素播放'
                },
                {
                    name: 'proxy',
                    displayName: '代理播放',
                    description: '通过代理服务器播放'
                },
                {
                    name: 'webrtc',
                    displayName: 'WebRTC播放',
                    description: '使用WebRTC技术播放'
                },
                {
                    name: 'hls',
                    displayName: 'HLS流播放',
                    description: '使用HLS自适应流播放'
                }
            ],
            
            // 性能指标配置
            metrics: [
                'loadTime',        // 加载时间
                'firstFrame',      // 首帧时间
                'bufferHealth',    // 缓冲健康度
                'frameDrops',      // 丢帧数
                'memoryUsage',     // 内存使用
                'cpuUsage',        // CPU使用率
                'networkUsage',    // 网络使用
                'playbackQuality'  // 播放质量
            ],
            
            // 测试环境配置
            environments: [
                {
                    name: 'desktop',
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    viewport: { width: 1920, height: 1080 },
                    connection: 'wifi'
                },
                {
                    name: 'tesla_model_s',
                    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Tesla/2021.24.5',
                    viewport: { width: 1200, height: 800 },
                    connection: 'cellular'
                },
                {
                    name: 'tesla_model_3',
                    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Tesla/2021.4.15',
                    viewport: { width: 1024, height: 768 },
                    connection: 'cellular'
                }
            ]
        };
        
        this.performanceObserver = null;
        this.memoryMonitor = null;
        this.networkMonitor = null;
    }
    
    /**
     * 开始性能基准测试
     */
    async startBenchmark(options = {}) {
        console.log('🚀 开始性能基准测试...');
        
        const config = {
            videos: options.videos || this.testConfig.testVideos,
            methods: options.methods || this.testConfig.testMethods,
            environment: options.environment || this.testConfig.environments[0],
            iterations: options.iterations || 3,
            timeout: options.timeout || 30000
        };
        
        this.testResults = [];
        
        try {
            // 初始化监控
            await this.initializeMonitoring();
            
            // 设置测试环境
            await this.setupTestEnvironment(config.environment);
            
            // 执行测试
            for (const video of config.videos) {
                for (const method of config.methods) {
                    console.log(`📹 测试视频: ${video.name}, 方案: ${method.displayName}`);
                    
                    const testResult = await this.runSingleTest({
                        video,
                        method,
                        environment: config.environment,
                        iterations: config.iterations,
                        timeout: config.timeout
                    });
                    
                    this.testResults.push(testResult);
                    
                    // 测试间隔，避免资源冲突
                    await this.delay(2000);
                }
            }
            
            // 生成测试报告
            const report = this.generateBenchmarkReport();
            console.log('✅ 性能基准测试完成');
            
            return report;
            
        } catch (error) {
            console.error('❌ 性能基准测试失败:', error);
            throw error;
        } finally {
            this.cleanupMonitoring();
        }
    }
    
    /**
     * 运行单个测试
     */
    async runSingleTest(testConfig) {
        const { video, method, environment, iterations, timeout } = testConfig;
        
        const testResults = [];
        
        for (let i = 0; i < iterations; i++) {
            console.log(`  📊 第 ${i + 1}/${iterations} 次测试`);
            
            try {
                const result = await this.executeTest({
                    video,
                    method,
                    environment,
                    iteration: i + 1,
                    timeout
                });
                
                testResults.push(result);
                
            } catch (error) {
                console.error(`  ❌ 第 ${i + 1} 次测试失败:`, error.message);
                testResults.push({
                    success: false,
                    error: error.message,
                    metrics: {}
                });
            }
            
            // 迭代间隔
            if (i < iterations - 1) {
                await this.delay(1000);
            }
        }
        
        // 计算平均值和统计信息
        const aggregatedResult = this.aggregateTestResults(testResults);
        
        return {
            video: video.name,
            method: method.name,
            environment: environment.name,
            iterations,
            results: testResults,
            aggregated: aggregatedResult,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 执行具体测试
     */
    async executeTest(config) {
        const { video, method, timeout } = config;
        
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('测试超时'));
            }, timeout);
            
            try {
                // 开始性能监控
                const performanceData = this.startPerformanceMonitoring();
                
                // 创建测试容器
                const testContainer = this.createTestContainer();
                
                // 根据方法执行不同的播放测试
                let testResult;
                switch (method.name) {
                    case 'direct':
                        testResult = await this.testDirectPlayback(video, testContainer);
                        break;
                    case 'proxy':
                        testResult = await this.testProxyPlayback(video, testContainer);
                        break;
                    case 'webrtc':
                        testResult = await this.testWebRTCPlayback(video, testContainer);
                        break;
                    case 'hls':
                        testResult = await this.testHLSPlayback(video, testContainer);
                        break;
                    default:
                        throw new Error(`未知的测试方法: ${method.name}`);
                }
                
                // 停止性能监控
                const finalMetrics = this.stopPerformanceMonitoring(performanceData);
                
                // 清理测试容器
                this.cleanupTestContainer(testContainer);
                
                clearTimeout(timeoutId);
                resolve({
                    success: true,
                    metrics: {
                        ...testResult,
                        ...finalMetrics
                    }
                });
                
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    
    /**
     * 测试直接播放
     */
    async testDirectPlayback(video, container) {
        const startTime = performance.now();
        
        return new Promise((resolve, reject) => {
            const videoElement = document.createElement('video');
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.preload = 'metadata';
            
            let firstFrameTime = null;
            let loadTime = null;
            let errorOccurred = false;
            
            // 监听事件
            videoElement.addEventListener('loadedmetadata', () => {
                loadTime = performance.now() - startTime;
            });
            
            videoElement.addEventListener('loadeddata', () => {
                if (!firstFrameTime) {
                    firstFrameTime = performance.now() - startTime;
                }
            });
            
            videoElement.addEventListener('canplay', () => {
                // 开始播放
                videoElement.play().catch(error => {
                    console.warn('自动播放失败:', error);
                });
            });
            
            videoElement.addEventListener('playing', () => {
                // 播放开始，收集指标
                setTimeout(() => {
                    if (!errorOccurred) {
                        resolve({
                            loadTime: loadTime || (performance.now() - startTime),
                            firstFrame: firstFrameTime || (performance.now() - startTime),
                            bufferHealth: this.calculateBufferHealth(videoElement),
                            frameDrops: this.getFrameDrops(videoElement),
                            playbackQuality: this.assessPlaybackQuality(videoElement)
                        });
                    }
                }, 2000);
            });
            
            videoElement.addEventListener('error', (event) => {
                errorOccurred = true;
                reject(new Error(`视频加载失败: ${event.target.error?.message || '未知错误'}`));
            });
            
            // 超时处理
            setTimeout(() => {
                if (!errorOccurred) {
                    errorOccurred = true;
                    reject(new Error('直接播放测试超时'));
                }
            }, 15000);
            
            // 开始加载
            container.appendChild(videoElement);
            videoElement.src = video.url;
        });
    }
    
    /**
     * 测试代理播放
     */
    async testProxyPlayback(video, container) {
        const startTime = performance.now();
        
        // 检查代理服务器是否可用
        const proxyUrl = 'http://localhost:3001';
        
        try {
            const response = await fetch(`${proxyUrl}/health`);
            if (!response.ok) {
                throw new Error('代理服务器不可用');
            }
        } catch (error) {
            throw new Error('无法连接到代理服务器');
        }
        
        return new Promise((resolve, reject) => {
            const videoElement = document.createElement('video');
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.preload = 'metadata';
            
            let firstFrameTime = null;
            let loadTime = null;
            let errorOccurred = false;
            
            // 监听事件（类似直接播放）
            videoElement.addEventListener('loadedmetadata', () => {
                loadTime = performance.now() - startTime;
            });
            
            videoElement.addEventListener('loadeddata', () => {
                if (!firstFrameTime) {
                    firstFrameTime = performance.now() - startTime;
                }
            });
            
            videoElement.addEventListener('playing', () => {
                setTimeout(() => {
                    if (!errorOccurred) {
                        resolve({
                            loadTime: loadTime || (performance.now() - startTime),
                            firstFrame: firstFrameTime || (performance.now() - startTime),
                            bufferHealth: this.calculateBufferHealth(videoElement),
                            frameDrops: this.getFrameDrops(videoElement),
                            playbackQuality: this.assessPlaybackQuality(videoElement),
                            proxyLatency: this.measureProxyLatency(proxyUrl)
                        });
                    }
                }, 2000);
            });
            
            videoElement.addEventListener('error', (event) => {
                errorOccurred = true;
                reject(new Error(`代理播放失败: ${event.target.error?.message || '未知错误'}`));
            });
            
            // 超时处理
            setTimeout(() => {
                if (!errorOccurred) {
                    errorOccurred = true;
                    reject(new Error('代理播放测试超时'));
                }
            }, 20000);
            
            // 通过代理加载
            container.appendChild(videoElement);
            videoElement.src = `${proxyUrl}/proxy?url=${encodeURIComponent(video.url)}`;
            
            videoElement.play().catch(error => {
                console.warn('代理播放自动播放失败:', error);
            });
        });
    }
    
    /**
     * 测试WebRTC播放
     */
    async testWebRTCPlayback(video, container) {
        const startTime = performance.now();
        
        // 模拟WebRTC连接测试
        return new Promise((resolve, reject) => {
            // 创建WebRTC连接
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            
            let connectionTime = null;
            let firstFrameTime = null;
            let errorOccurred = false;
            
            // 监听连接状态
            peerConnection.addEventListener('connectionstatechange', () => {
                const state = peerConnection.connectionState;
                console.log('WebRTC连接状态:', state);
                
                if (state === 'connected' && !connectionTime) {
                    connectionTime = performance.now() - startTime;
                }
                
                if (state === 'failed' || state === 'disconnected') {
                    if (!errorOccurred) {
                        errorOccurred = true;
                        reject(new Error('WebRTC连接失败'));
                    }
                }
            });
            
            // 监听媒体流
            peerConnection.addEventListener('track', (event) => {
                if (!firstFrameTime) {
                    firstFrameTime = performance.now() - startTime;
                }
                
                const videoElement = document.createElement('video');
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.srcObject = event.streams[0];
                videoElement.autoplay = true;
                
                container.appendChild(videoElement);
                
                // 收集指标
                setTimeout(() => {
                    if (!errorOccurred) {
                        resolve({
                            loadTime: connectionTime || (performance.now() - startTime),
                            firstFrame: firstFrameTime || (performance.now() - startTime),
                            bufferHealth: 100, // WebRTC通常不需要缓冲
                            frameDrops: this.getWebRTCStats(peerConnection),
                            playbackQuality: this.assessWebRTCQuality(peerConnection),
                            connectionLatency: connectionTime
                        });
                    }
                }, 3000);
            });
            
            // 超时处理
            setTimeout(() => {
                if (!errorOccurred) {
                    errorOccurred = true;
                    reject(new Error('WebRTC播放测试超时'));
                }
            }, 25000);
            
            // 模拟WebRTC信令过程
            this.simulateWebRTCSignaling(peerConnection, video);
        });
    }
    
    /**
     * 测试HLS播放
     */
    async testHLSPlayback(video, container) {
        const startTime = performance.now();
        
        // 检查HLS支持
        if (!this.isHLSSupported()) {
            throw new Error('浏览器不支持HLS播放');
        }
        
        return new Promise((resolve, reject) => {
            const videoElement = document.createElement('video');
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.preload = 'metadata';
            
            let firstFrameTime = null;
            let loadTime = null;
            let errorOccurred = false;
            
            // HLS特定的监听
            videoElement.addEventListener('loadedmetadata', () => {
                loadTime = performance.now() - startTime;
            });
            
            videoElement.addEventListener('loadeddata', () => {
                if (!firstFrameTime) {
                    firstFrameTime = performance.now() - startTime;
                }
            });
            
            videoElement.addEventListener('playing', () => {
                setTimeout(() => {
                    if (!errorOccurred) {
                        resolve({
                            loadTime: loadTime || (performance.now() - startTime),
                            firstFrame: firstFrameTime || (performance.now() - startTime),
                            bufferHealth: this.calculateBufferHealth(videoElement),
                            frameDrops: this.getFrameDrops(videoElement),
                            playbackQuality: this.assessPlaybackQuality(videoElement),
                            adaptiveBitrate: this.getHLSBitrateInfo(videoElement)
                        });
                    }
                }, 2000);
            });
            
            videoElement.addEventListener('error', (event) => {
                errorOccurred = true;
                reject(new Error(`HLS播放失败: ${event.target.error?.message || '未知错误'}`));
            });
            
            // 超时处理
            setTimeout(() => {
                if (!errorOccurred) {
                    errorOccurred = true;
                    reject(new Error('HLS播放测试超时'));
                }
            }, 20000);
            
            // 使用HLS.js或原生HLS
            container.appendChild(videoElement);
            
            // 模拟HLS流URL（实际应用中需要真实的HLS流）
            const hlsUrl = this.convertToHLSUrl(video.url);
            videoElement.src = hlsUrl;
            
            videoElement.play().catch(error => {
                console.warn('HLS自动播放失败:', error);
            });
        });
    }
    
    /**
     * 初始化性能监控
     */
    async initializeMonitoring() {
        // 初始化Performance Observer
        if ('PerformanceObserver' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                // 处理性能条目
            });
            this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
        }
        
        // 初始化内存监控
        this.memoryMonitor = {
            initial: this.getMemoryUsage(),
            samples: []
        };
        
        // 初始化网络监控
        this.networkMonitor = {
            initial: this.getNetworkInfo(),
            samples: []
        };
    }
    
    /**
     * 开始性能监控
     */
    startPerformanceMonitoring() {
        const startTime = performance.now();
        const initialMemory = this.getMemoryUsage();
        const initialNetwork = this.getNetworkInfo();
        
        return {
            startTime,
            initialMemory,
            initialNetwork,
            samples: []
        };
    }
    
    /**
     * 停止性能监控
     */
    stopPerformanceMonitoring(performanceData) {
        const endTime = performance.now();
        const finalMemory = this.getMemoryUsage();
        const finalNetwork = this.getNetworkInfo();
        
        return {
            duration: endTime - performanceData.startTime,
            memoryUsage: {
                initial: performanceData.initialMemory,
                final: finalMemory,
                delta: finalMemory.usedJSHeapSize - performanceData.initialMemory.usedJSHeapSize
            },
            networkUsage: {
                initial: performanceData.initialNetwork,
                final: finalNetwork
            },
            cpuUsage: this.estimateCPUUsage(performanceData.startTime, endTime)
        };
    }
    
    /**
     * 获取内存使用情况
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
    }
    
    /**
     * 获取网络信息
     */
    getNetworkInfo() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
        return { effectiveType: 'unknown', downlink: 0, rtt: 0, saveData: false };
    }
    
    /**
     * 估算CPU使用率
     */
    estimateCPUUsage(startTime, endTime) {
        // 简单的CPU使用率估算
        const duration = endTime - startTime;
        const entries = performance.getEntriesByType('measure');
        const totalMeasureTime = entries.reduce((sum, entry) => sum + entry.duration, 0);
        
        return Math.min(100, (totalMeasureTime / duration) * 100);
    }
    
    /**
     * 计算缓冲健康度
     */
    calculateBufferHealth(videoElement) {
        try {
            const buffered = videoElement.buffered;
            const currentTime = videoElement.currentTime;
            const duration = videoElement.duration;
            
            if (buffered.length === 0 || !duration) return 0;
            
            // 计算当前位置的缓冲长度
            let bufferAhead = 0;
            for (let i = 0; i < buffered.length; i++) {
                const start = buffered.start(i);
                const end = buffered.end(i);
                
                if (currentTime >= start && currentTime <= end) {
                    bufferAhead = end - currentTime;
                    break;
                }
            }
            
            // 返回缓冲健康度百分比
            return Math.min(100, (bufferAhead / 10) * 100); // 10秒为满分
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * 获取丢帧信息
     */
    getFrameDrops(videoElement) {
        try {
            if ('getVideoPlaybackQuality' in videoElement) {
                const quality = videoElement.getVideoPlaybackQuality();
                return {
                    droppedVideoFrames: quality.droppedVideoFrames,
                    totalVideoFrames: quality.totalVideoFrames,
                    dropRate: quality.totalVideoFrames > 0 ? 
                        (quality.droppedVideoFrames / quality.totalVideoFrames) * 100 : 0
                };
            }
        } catch (error) {
            console.warn('无法获取视频播放质量信息:', error);
        }
        return { droppedVideoFrames: 0, totalVideoFrames: 0, dropRate: 0 };
    }
    
    /**
     * 评估播放质量
     */
    assessPlaybackQuality(videoElement) {
        try {
            const frameDrops = this.getFrameDrops(videoElement);
            const bufferHealth = this.calculateBufferHealth(videoElement);
            
            // 综合评分
            let score = 100;
            score -= frameDrops.dropRate * 2; // 丢帧率影响
            score -= (100 - bufferHealth) * 0.5; // 缓冲健康度影响
            
            return Math.max(0, Math.round(score));
        } catch (error) {
            return 50; // 默认中等质量
        }
    }
    
    /**
     * 聚合测试结果
     */
    aggregateTestResults(results) {
        const successfulResults = results.filter(r => r.success);
        
        if (successfulResults.length === 0) {
            return {
                success: false,
                successRate: 0,
                averageMetrics: {},
                reliability: 'poor'
            };
        }
        
        const metrics = {};
        const metricKeys = Object.keys(successfulResults[0].metrics);
        
        // 计算平均值
        for (const key of metricKeys) {
            const values = successfulResults
                .map(r => r.metrics[key])
                .filter(v => typeof v === 'number' && !isNaN(v));
            
            if (values.length > 0) {
                metrics[key] = {
                    average: values.reduce((sum, v) => sum + v, 0) / values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    stdDev: this.calculateStandardDeviation(values)
                };
            }
        }
        
        const successRate = (successfulResults.length / results.length) * 100;
        const reliability = this.assessReliability(successRate, metrics);
        
        return {
            success: true,
            successRate,
            averageMetrics: metrics,
            reliability,
            totalTests: results.length,
            successfulTests: successfulResults.length
        };
    }
    
    /**
     * 计算标准差
     */
    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    }
    
    /**
     * 评估可靠性
     */
    assessReliability(successRate, metrics) {
        if (successRate >= 95) return 'excellent';
        if (successRate >= 85) return 'good';
        if (successRate >= 70) return 'fair';
        if (successRate >= 50) return 'poor';
        return 'very_poor';
    }
    
    /**
     * 生成基准测试报告
     */
    generateBenchmarkReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: this.generateSummary(),
            results: this.testResults,
            recommendations: this.generateRecommendations(),
            charts: this.generateChartData()
        };
        
        return report;
    }
    
    /**
     * 生成摘要
     */
    generateSummary() {
        const totalTests = this.testResults.length;
        const successfulTests = this.testResults.filter(r => r.aggregated.success).length;
        const overallSuccessRate = (successfulTests / totalTests) * 100;
        
        // 找出最佳方案
        const bestMethod = this.findBestMethod();
        const worstMethod = this.findWorstMethod();
        
        return {
            totalTests,
            successfulTests,
            overallSuccessRate,
            bestMethod,
            worstMethod,
            testDuration: this.calculateTotalTestDuration()
        };
    }
    
    /**
     * 找出最佳方案
     */
    findBestMethod() {
        const methodScores = {};
        
        for (const result of this.testResults) {
            if (!result.aggregated.success) continue;
            
            const method = result.method;
            if (!methodScores[method]) {
                methodScores[method] = {
                    totalScore: 0,
                    count: 0,
                    successRate: 0
                };
            }
            
            // 计算综合得分
            const metrics = result.aggregated.averageMetrics;
            let score = 100;
            
            // 加载时间影响（越短越好）
            if (metrics.loadTime) {
                score -= Math.min(50, metrics.loadTime.average / 100);
            }
            
            // 播放质量影响
            if (metrics.playbackQuality) {
                score += (metrics.playbackQuality.average - 50) * 0.5;
            }
            
            // 成功率影响
            score *= (result.aggregated.successRate / 100);
            
            methodScores[method].totalScore += score;
            methodScores[method].count++;
            methodScores[method].successRate += result.aggregated.successRate;
        }
        
        // 计算平均分数
        let bestMethod = null;
        let bestScore = 0;
        
        for (const [method, data] of Object.entries(methodScores)) {
            const avgScore = data.totalScore / data.count;
            if (avgScore > bestScore) {
                bestScore = avgScore;
                bestMethod = method;
            }
        }
        
        return {
            method: bestMethod,
            score: bestScore,
            details: methodScores[bestMethod]
        };
    }
    
    /**
     * 找出最差方案
     */
    findWorstMethod() {
        // 类似findBestMethod，但找最低分
        const methodScores = {};
        
        for (const result of this.testResults) {
            const method = result.method;
            if (!methodScores[method]) {
                methodScores[method] = {
                    totalScore: 0,
                    count: 0,
                    successRate: 0
                };
            }
            
            let score = result.aggregated.success ? 50 : 0;
            score *= (result.aggregated.successRate / 100);
            
            methodScores[method].totalScore += score;
            methodScores[method].count++;
        }
        
        let worstMethod = null;
        let worstScore = 100;
        
        for (const [method, data] of Object.entries(methodScores)) {
            const avgScore = data.totalScore / data.count;
            if (avgScore < worstScore) {
                worstScore = avgScore;
                worstMethod = method;
            }
        }
        
        return {
            method: worstMethod,
            score: worstScore,
            details: methodScores[worstMethod]
        };
    }
    
    /**
     * 生成改进建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        // 基于测试结果生成建议
        const summary = this.generateSummary();
        
        if (summary.overallSuccessRate < 80) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                title: '提高系统可靠性',
                description: `整体成功率仅为${summary.overallSuccessRate.toFixed(1)}%，需要改进`,
                actions: [
                    '增加错误处理和重试机制',
                    '优化网络连接稳定性',
                    '实现更好的降级策略'
                ]
            });
        }
        
        if (summary.bestMethod.method === 'direct') {
            recommendations.push({
                type: 'optimization',
                priority: 'medium',
                title: '考虑使用代理方案',
                description: '直接播放表现最佳，但在Tesla环境中可能受限',
                actions: [
                    '在Tesla环境中测试代理方案',
                    '优化代理服务器性能',
                    '实现智能方案选择'
                ]
            });
        }
        
        return recommendations;
    }
    
    /**
     * 生成图表数据
     */
    generateChartData() {
        return {
            performanceComparison: this.generatePerformanceComparisonData(),
            reliabilityTrends: this.generateReliabilityTrendsData(),
            resourceUsage: this.generateResourceUsageData()
        };
    }
    
    /**
     * 工具方法
     */
    createTestContainer() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '-1000px';
        container.style.left = '-1000px';
        container.style.width = '640px';
        container.style.height = '360px';
        container.style.visibility = 'hidden';
        document.body.appendChild(container);
        return container;
    }
    
    cleanupTestContainer(container) {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 其他辅助方法...
    setupTestEnvironment(environment) {
        // 设置测试环境
        return Promise.resolve();
    }
    
    cleanupMonitoring() {
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
    }
    
    measureProxyLatency(proxyUrl) {
        // 测量代理延迟
        return Math.random() * 100 + 50; // 模拟值
    }
    
    simulateWebRTCSignaling(peerConnection, video) {
        // 模拟WebRTC信令
        setTimeout(() => {
            // 模拟连接建立
        }, 1000);
    }
    
    getWebRTCStats(peerConnection) {
        // 获取WebRTC统计信息
        return { droppedVideoFrames: 0, totalVideoFrames: 1000, dropRate: 0 };
    }
    
    assessWebRTCQuality(peerConnection) {
        // 评估WebRTC质量
        return 85;
    }
    
    isHLSSupported() {
        const video = document.createElement('video');
        return video.canPlayType('application/vnd.apple.mpegurl') !== '';
    }
    
    convertToHLSUrl(url) {
        // 转换为HLS URL（模拟）
        return url.replace('.mp4', '.m3u8');
    }
    
    getHLSBitrateInfo(videoElement) {
        // 获取HLS比特率信息
        return { currentBitrate: 1000000, availableBitrates: [500000, 1000000, 2000000] };
    }
    
    calculateTotalTestDuration() {
        // 计算总测试时长
        return this.testResults.length * 30; // 估算值
    }
    
    generatePerformanceComparisonData() {
        // 生成性能对比数据
        return {};
    }
    
    generateReliabilityTrendsData() {
        // 生成可靠性趋势数据
        return {};
    }
    
    generateResourceUsageData() {
        // 生成资源使用数据
        return {};
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceBenchmark;
} else if (typeof window !== 'undefined') {
    window.PerformanceBenchmark = PerformanceBenchmark;
}

// 自动运行基准测试（如果直接在浏览器中加载）
if (typeof window !== 'undefined' && window.location) {
    window.runPerformanceBenchmark = async function(options = {}) {
        const benchmark = new PerformanceBenchmark();
        try {
            console.log('🚀 开始性能基准测试...');
            const report = await benchmark.startBenchmark(options);
            console.log('✅ 性能基准测试完成:', report);
            return report;
        } catch (error) {
            console.error('❌ 性能基准测试失败:', error);
            throw error;
        }
    };
}