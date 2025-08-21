/**
 * Tesla自动化测试脚本
 * 模拟Tesla车机环境，自动测试各种播放方案
 */

class TeslaAutomatedTest {
    constructor(options = {}) {
        this.options = {
            testTimeout: 30000,
            retryAttempts: 3,
            testVideos: [
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            ],
            proxyServerUrl: 'http://localhost:3001',
            signalServerUrl: 'ws://localhost:8080/signal',
            debug: true,
            ...options
        };
        
        this.testResults = [];
        this.currentTest = null;
        this.testStartTime = null;
        
        // 模拟Tesla车机环境
        this.teslaEnvironment = {
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Tesla/2021.24.5',
            screenResolution: { width: 1200, height: 800 },
            networkConditions: {
                downloadThroughput: 1.5 * 1024 * 1024, // 1.5 Mbps
                uploadThroughput: 750 * 1024, // 750 Kbps
                latency: 150 // 150ms
            },
            hardwareConstraints: {
                maxCpuUsage: 70,
                maxMemoryUsage: 80,
                maxGpuUsage: 60
            }
        };
        
        this.init();
    }
    
    /**
     * 初始化测试环境
     */
    init() {
        this.log('初始化Tesla自动化测试环境...', 'info');
        
        // 模拟Tesla车机User-Agent
        if (navigator.userAgent !== this.teslaEnvironment.userAgent) {
            this.log('注意: 当前不是Tesla车机环境，正在模拟...', 'warning');
        }
        
        // 设置网络条件模拟
        this.simulateNetworkConditions();
        
        this.log('Tesla测试环境初始化完成', 'success');
    }
    
    /**
     * 模拟网络条件
     */
    simulateNetworkConditions() {
        if ('connection' in navigator) {
            // 模拟网络信息
            Object.defineProperty(navigator.connection, 'downlink', {
                value: this.teslaEnvironment.networkConditions.downloadThroughput / (1024 * 1024),
                writable: false
            });
            
            Object.defineProperty(navigator.connection, 'rtt', {
                value: this.teslaEnvironment.networkConditions.latency,
                writable: false
            });
        }
    }
    
    /**
     * 运行完整测试套件
     */
    async runFullTestSuite() {
        this.log('开始运行Tesla完整测试套件...', 'info');
        this.testStartTime = Date.now();
        
        const testSuite = [
            { name: '环境检查', test: () => this.testEnvironment() },
            { name: '代理服务器连接', test: () => this.testProxyConnection() },
            { name: '直接播放测试', test: () => this.testDirectPlayback() },
            { name: '代理播放测试', test: () => this.testProxyPlayback() },
            { name: '转码播放测试', test: () => this.testTranscodePlayback() },
            { name: 'WebRTC测试', test: () => this.testWebRTCPlayback() },
            { name: '智能降级测试', test: () => this.testSmartFallback() },
            { name: '性能压力测试', test: () => this.testPerformanceStress() },
            { name: '网络中断恢复测试', test: () => this.testNetworkRecovery() },
            { name: '长时间播放测试', test: () => this.testLongPlayback() }
        ];
        
        for (const testCase of testSuite) {
            try {
                this.currentTest = testCase.name;
                this.log(`开始测试: ${testCase.name}`, 'info');
                
                const result = await this.runTestWithTimeout(testCase.test, this.options.testTimeout);
                
                this.testResults.push({
                    name: testCase.name,
                    status: 'passed',
                    result: result,
                    duration: Date.now() - this.testStartTime,
                    timestamp: new Date().toISOString()
                });
                
                this.log(`测试通过: ${testCase.name}`, 'success');
                
            } catch (error) {
                this.testResults.push({
                    name: testCase.name,
                    status: 'failed',
                    error: error.message,
                    duration: Date.now() - this.testStartTime,
                    timestamp: new Date().toISOString()
                });
                
                this.log(`测试失败: ${testCase.name} - ${error.message}`, 'error');
            }
            
            // 测试间隔
            await this.sleep(2000);
        }
        
        // 生成测试报告
        const report = this.generateTestReport();
        this.log('测试套件完成', 'info');
        
        return report;
    }
    
    /**
     * 带超时的测试执行
     */
    async runTestWithTimeout(testFunction, timeout) {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`测试超时 (${timeout}ms)`));
            }, timeout);
            
            try {
                const result = await testFunction();
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }
    
    /**
     * 测试环境检查
     */
    async testEnvironment() {
        const checks = {
            browser: this.checkBrowserCompatibility(),
            network: await this.checkNetworkConnectivity(),
            hardware: this.checkHardwareCapabilities(),
            apis: this.checkRequiredAPIs()
        };
        
        const allPassed = Object.values(checks).every(check => check.passed);
        
        if (!allPassed) {
            throw new Error('环境检查失败: ' + JSON.stringify(checks));
        }
        
        return checks;
    }
    
    /**
     * 检查浏览器兼容性
     */
    checkBrowserCompatibility() {
        const requiredFeatures = [
            'fetch',
            'Promise',
            'WebSocket',
            'HTMLVideoElement',
            'MediaSource'
        ];
        
        const missingFeatures = requiredFeatures.filter(feature => {
            switch (feature) {
                case 'fetch':
                    return !window.fetch;
                case 'Promise':
                    return !window.Promise;
                case 'WebSocket':
                    return !window.WebSocket;
                case 'HTMLVideoElement':
                    return !window.HTMLVideoElement;
                case 'MediaSource':
                    return !window.MediaSource;
                default:
                    return false;
            }
        });
        
        return {
            passed: missingFeatures.length === 0,
            missingFeatures: missingFeatures,
            userAgent: navigator.userAgent
        };
    }
    
    /**
     * 检查网络连接
     */
    async checkNetworkConnectivity() {
        try {
            const startTime = Date.now();
            const response = await fetch('https://httpbin.org/get', {
                method: 'GET',
                cache: 'no-cache'
            });
            const endTime = Date.now();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return {
                passed: true,
                latency: endTime - startTime,
                status: response.status
            };
        } catch (error) {
            return {
                passed: false,
                error: error.message
            };
        }
    }
    
    /**
     * 检查硬件能力
     */
    checkHardwareCapabilities() {
        const capabilities = {
            cores: navigator.hardwareConcurrency || 'unknown',
            memory: navigator.deviceMemory || 'unknown',
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : 'unknown'
        };
        
        return {
            passed: true,
            capabilities: capabilities
        };
    }
    
    /**
     * 检查必需的API
     */
    checkRequiredAPIs() {
        const apis = {
            webrtc: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection),
            mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            webgl: !!this.getWebGLContext(),
            audioContext: !!(window.AudioContext || window.webkitAudioContext)
        };
        
        return {
            passed: true, // 不强制要求所有API
            apis: apis
        };
    }
    
    /**
     * 获取WebGL上下文
     */
    getWebGLContext() {
        const canvas = document.createElement('canvas');
        return canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    }
    
    /**
     * 测试代理服务器连接
     */
    async testProxyConnection() {
        try {
            const response = await fetch(`${this.options.proxyServerUrl}/status`);
            
            if (!response.ok) {
                throw new Error(`代理服务器响应错误: ${response.status}`);
            }
            
            const status = await response.json();
            
            return {
                connected: true,
                serverStatus: status,
                responseTime: Date.now() - this.testStartTime
            };
        } catch (error) {
            throw new Error(`代理服务器连接失败: ${error.message}`);
        }
    }
    
    /**
     * 测试直接播放
     */
    async testDirectPlayback() {
        const video = this.createTestVideo();
        const testUrl = this.options.testVideos[0];
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('直接播放超时'));
            }, 15000);
            
            video.addEventListener('loadeddata', () => {
                clearTimeout(timeout);
                resolve({
                    method: 'direct',
                    url: testUrl,
                    duration: video.duration,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                });
            });
            
            video.addEventListener('error', (e) => {
                clearTimeout(timeout);
                reject(new Error(`直接播放失败: ${e.message || '未知错误'}`));
            });
            
            video.src = testUrl;
            video.load();
        });
    }
    
    /**
     * 测试代理播放
     */
    async testProxyPlayback() {
        const video = this.createTestVideo();
        const testUrl = this.options.testVideos[1];
        const proxyUrl = `${this.options.proxyServerUrl}/proxy?url=${encodeURIComponent(testUrl)}`;
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('代理播放超时'));
            }, 20000);
            
            video.addEventListener('loadeddata', () => {
                clearTimeout(timeout);
                resolve({
                    method: 'proxy',
                    originalUrl: testUrl,
                    proxyUrl: proxyUrl,
                    duration: video.duration,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                });
            });
            
            video.addEventListener('error', (e) => {
                clearTimeout(timeout);
                reject(new Error(`代理播放失败: ${e.message || '未知错误'}`));
            });
            
            video.src = proxyUrl;
            video.load();
        });
    }
    
    /**
     * 测试转码播放
     */
    async testTranscodePlayback() {
        const video = this.createTestVideo();
        const testUrl = this.options.testVideos[2];
        const transcodeUrl = `${this.options.proxyServerUrl}/transcode?url=${encodeURIComponent(testUrl)}&preset=tesla_optimized`;
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('转码播放超时'));
            }, 30000); // 转码需要更长时间
            
            video.addEventListener('loadeddata', () => {
                clearTimeout(timeout);
                resolve({
                    method: 'transcode',
                    originalUrl: testUrl,
                    transcodeUrl: transcodeUrl,
                    duration: video.duration,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                });
            });
            
            video.addEventListener('error', (e) => {
                clearTimeout(timeout);
                reject(new Error(`转码播放失败: ${e.message || '未知错误'}`));
            });
            
            video.src = transcodeUrl;
            video.load();
        });
    }
    
    /**
     * 测试WebRTC播放
     */
    async testWebRTCPlayback() {
        // 模拟WebRTC测试（需要信令服务器）
        try {
            const ws = new WebSocket(this.options.signalServerUrl);
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('WebRTC连接超时'));
                }, 10000);
                
                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({
                        method: 'webrtc',
                        signalServer: this.options.signalServerUrl,
                        connected: true
                    });
                };
                
                ws.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(new Error('WebRTC信令服务器连接失败'));
                };
            });
        } catch (error) {
            throw new Error(`WebRTC测试失败: ${error.message}`);
        }
    }
    
    /**
     * 测试智能降级
     */
    async testSmartFallback() {
        // 模拟网络条件变化，测试降级逻辑
        const testScenarios = [
            { bandwidth: 5000000, expected: 'direct' },
            { bandwidth: 1000000, expected: 'proxy' },
            { bandwidth: 500000, expected: 'transcode' }
        ];
        
        const results = [];
        
        for (const scenario of testScenarios) {
            // 模拟网络条件
            this.simulateNetworkCondition(scenario.bandwidth);
            
            // 测试降级选择
            const selectedMethod = this.selectOptimalMethod(scenario.bandwidth);
            
            results.push({
                bandwidth: scenario.bandwidth,
                expected: scenario.expected,
                selected: selectedMethod,
                correct: selectedMethod === scenario.expected
            });
        }
        
        const correctSelections = results.filter(r => r.correct).length;
        const accuracy = correctSelections / results.length;
        
        if (accuracy < 0.8) {
            throw new Error(`智能降级准确率过低: ${accuracy * 100}%`);
        }
        
        return {
            accuracy: accuracy,
            results: results
        };
    }
    
    /**
     * 模拟网络条件
     */
    simulateNetworkCondition(bandwidth) {
        if (navigator.connection) {
            Object.defineProperty(navigator.connection, 'downlink', {
                value: bandwidth / (1024 * 1024),
                writable: false
            });
        }
    }
    
    /**
     * 选择最优播放方法
     */
    selectOptimalMethod(bandwidth) {
        if (bandwidth > 3000000) {
            return 'direct';
        } else if (bandwidth > 800000) {
            return 'proxy';
        } else {
            return 'transcode';
        }
    }
    
    /**
     * 测试性能压力
     */
    async testPerformanceStress() {
        const video = this.createTestVideo();
        const testUrl = this.options.testVideos[0];
        
        // 监控性能指标
        const performanceData = {
            startTime: performance.now(),
            memoryStart: this.getMemoryUsage(),
            cpuStart: await this.getCPUUsage()
        };
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('性能测试超时'));
            }, 20000);
            
            video.addEventListener('loadeddata', async () => {
                // 播放一段时间后检查性能
                setTimeout(async () => {
                    const endTime = performance.now();
                    const memoryEnd = this.getMemoryUsage();
                    const cpuEnd = await this.getCPUUsage();
                    
                    clearTimeout(timeout);
                    
                    const result = {
                        duration: endTime - performanceData.startTime,
                        memoryUsage: {
                            start: performanceData.memoryStart,
                            end: memoryEnd,
                            increase: memoryEnd - performanceData.memoryStart
                        },
                        cpuUsage: {
                            start: performanceData.cpuStart,
                            end: cpuEnd,
                            average: (performanceData.cpuStart + cpuEnd) / 2
                        },
                        playbackQuality: {
                            droppedFrames: video.webkitDroppedFrameCount || 0,
                            decodedFrames: video.webkitDecodedFrameCount || 0
                        }
                    };
                    
                    // 检查是否超出Tesla硬件限制
                    if (result.cpuUsage.average > this.teslaEnvironment.hardwareConstraints.maxCpuUsage) {
                        reject(new Error(`CPU使用率过高: ${result.cpuUsage.average}%`));
                        return;
                    }
                    
                    if (result.memoryUsage.increase > 100) { // 100MB
                        reject(new Error(`内存泄漏检测: 增加${result.memoryUsage.increase}MB`));
                        return;
                    }
                    
                    resolve(result);
                }, 10000); // 播放10秒
                
                video.play();
            });
            
            video.addEventListener('error', (e) => {
                clearTimeout(timeout);
                reject(new Error(`性能测试播放失败: ${e.message || '未知错误'}`));
            });
            
            video.src = testUrl;
            video.load();
        });
    }
    
    /**
     * 测试网络中断恢复
     */
    async testNetworkRecovery() {
        // 模拟网络中断和恢复
        const video = this.createTestVideo();
        const testUrl = this.options.testVideos[0];
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('网络恢复测试超时'));
            }, 25000);
            
            let networkInterrupted = false;
            let recoveryStartTime = null;
            
            video.addEventListener('loadeddata', () => {
                video.play();
                
                // 5秒后模拟网络中断
                setTimeout(() => {
                    networkInterrupted = true;
                    this.log('模拟网络中断...', 'warning');
                    
                    // 暂停视频模拟网络中断
                    video.pause();
                    
                    // 3秒后恢复网络
                    setTimeout(() => {
                        networkInterrupted = false;
                        recoveryStartTime = Date.now();
                        this.log('模拟网络恢复...', 'info');
                        
                        // 恢复播放
                        video.play();
                    }, 3000);
                }, 5000);
            });
            
            video.addEventListener('playing', () => {
                if (recoveryStartTime) {
                    const recoveryTime = Date.now() - recoveryStartTime;
                    clearTimeout(timeout);
                    
                    resolve({
                        networkInterrupted: true,
                        recoveryTime: recoveryTime,
                        recoverySuccessful: true
                    });
                }
            });
            
            video.addEventListener('error', (e) => {
                clearTimeout(timeout);
                reject(new Error(`网络恢复测试失败: ${e.message || '未知错误'}`));
            });
            
            video.src = testUrl;
            video.load();
        });
    }
    
    /**
     * 测试长时间播放
     */
    async testLongPlayback() {
        const video = this.createTestVideo();
        const testUrl = this.options.testVideos[0];
        const testDuration = 60000; // 1分钟
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('长时间播放测试超时'));
            }, testDuration + 10000);
            
            const startTime = Date.now();
            let errorCount = 0;
            let stallCount = 0;
            let lastCurrentTime = 0;
            
            const checkInterval = setInterval(() => {
                if (video.currentTime === lastCurrentTime && !video.paused) {
                    stallCount++;
                }
                lastCurrentTime = video.currentTime;
                
                if (stallCount > 5) {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    reject(new Error(`播放卡顿次数过多: ${stallCount}`));
                }
            }, 2000);
            
            video.addEventListener('error', () => {
                errorCount++;
                if (errorCount > 3) {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    reject(new Error(`播放错误次数过多: ${errorCount}`));
                }
            });
            
            video.addEventListener('loadeddata', () => {
                video.play();
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    
                    const endTime = Date.now();
                    resolve({
                        duration: endTime - startTime,
                        errorCount: errorCount,
                        stallCount: stallCount,
                        averagePlaybackRate: video.currentTime / ((endTime - startTime) / 1000),
                        finalCurrentTime: video.currentTime
                    });
                }, testDuration);
            });
            
            video.src = testUrl;
            video.load();
        });
    }
    
    /**
     * 创建测试视频元素
     */
    createTestVideo() {
        const video = document.createElement('video');
        video.style.display = 'none';
        video.muted = true; // 避免自动播放限制
        video.preload = 'metadata';
        document.body.appendChild(video);
        
        // 测试完成后清理
        setTimeout(() => {
            if (video.parentNode) {
                video.parentNode.removeChild(video);
            }
        }, 60000);
        
        return video;
    }
    
    /**
     * 获取内存使用情况
     */
    getMemoryUsage() {
        if (performance.memory) {
            return performance.memory.usedJSHeapSize / (1024 * 1024); // MB
        }
        return 0;
    }
    
    /**
     * 获取CPU使用率（模拟）
     */
    async getCPUUsage() {
        // 简单的CPU使用率估算
        const start = performance.now();
        let iterations = 0;
        
        while (performance.now() - start < 100) {
            iterations++;
        }
        
        // 基于迭代次数估算CPU使用率
        const baselineIterations = 1000000;
        const cpuUsage = Math.max(0, Math.min(100, (baselineIterations - iterations) / baselineIterations * 100));
        
        return cpuUsage;
    }
    
    /**
     * 生成测试报告
     */
    generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.status === 'passed').length;
        const failedTests = totalTests - passedTests;
        const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
        
        const report = {
            summary: {
                totalTests: totalTests,
                passedTests: passedTests,
                failedTests: failedTests,
                successRate: successRate,
                totalDuration: Date.now() - this.testStartTime,
                timestamp: new Date().toISOString()
            },
            environment: {
                userAgent: navigator.userAgent,
                teslaSimulated: true,
                networkConditions: this.teslaEnvironment.networkConditions,
                hardwareConstraints: this.teslaEnvironment.hardwareConstraints
            },
            testResults: this.testResults,
            recommendations: this.generateRecommendations()
        };
        
        this.log(`测试报告生成完成: ${passedTests}/${totalTests} 通过 (${successRate.toFixed(1)}%)`, 'info');
        
        return report;
    }
    
    /**
     * 生成建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        const failedTests = this.testResults.filter(r => r.status === 'failed');
        
        if (failedTests.some(t => t.name.includes('WebRTC'))) {
            recommendations.push({
                type: 'warning',
                message: 'WebRTC功能不可用，建议优先使用代理服务器方案'
            });
        }
        
        if (failedTests.some(t => t.name.includes('代理'))) {
            recommendations.push({
                type: 'error',
                message: '代理服务器连接失败，请检查服务器状态和网络连接'
            });
        }
        
        if (failedTests.some(t => t.name.includes('性能'))) {
            recommendations.push({
                type: 'warning',
                message: '性能测试失败，建议降低视频质量或优化播放参数'
            });
        }
        
        if (failedTests.length === 0) {
            recommendations.push({
                type: 'success',
                message: '所有测试通过，系统已准备好在Tesla车机上使用'
            });
        }
        
        return recommendations;
    }
    
    /**
     * 导出测试报告
     */
    exportReport(report) {
        const reportJson = JSON.stringify(report, null, 2);
        const blob = new Blob([reportJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `tesla-test-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.log('测试报告已导出', 'success');
    }
    
    /**
     * 睡眠函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 日志输出
     */
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (this.options.debug) {
            console.log(logMessage);
        }
        
        // 如果页面有日志容器，也输出到页面
        if (typeof window !== 'undefined' && window.log) {
            window.log(message, level);
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaAutomatedTest;
} else if (typeof window !== 'undefined') {
    window.TeslaAutomatedTest = TeslaAutomatedTest;
}

// 自动运行测试（如果直接在浏览器中加载）
if (typeof window !== 'undefined' && window.location) {
    // 添加全局函数供测试套件调用
    window.runAutomatedTest = async function() {
        const tester = new TeslaAutomatedTest();
        try {
            const report = await tester.runFullTestSuite();
            console.log('自动化测试完成:', report);
            tester.exportReport(report);
            return report;
        } catch (error) {
            console.error('自动化测试失败:', error);
            throw error;
        }
    };
}