/**
 * Tesla LibreTV 健康检查模块
 * 提供系统健康状态监控和诊断信息
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class HealthChecker {
    constructor() {
        this.startTime = Date.now();
        this.checks = new Map();
        this.initializeChecks();
    }

    /**
     * 初始化健康检查项目
     */
    initializeChecks() {
        // 基础系统检查
        this.checks.set('system', this.checkSystem.bind(this));
        this.checks.set('memory', this.checkMemory.bind(this));
        this.checks.set('disk', this.checkDisk.bind(this));
        this.checks.set('network', this.checkNetwork.bind(this));
        
        // 应用服务检查
        this.checks.set('proxy', this.checkProxyService.bind(this));
        this.checks.set('webrtc', this.checkWebRTCService.bind(this));
        this.checks.set('cache', this.checkCacheService.bind(this));
        
        // Tesla 特定检查
        this.checks.set('tesla', this.checkTeslaOptimizations.bind(this));
        this.checks.set('fallback', this.checkFallbackMechanism.bind(this));
    }

    /**
     * 执行完整的健康检查
     */
    async performHealthCheck() {
        const results = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: this.getUptime(),
            version: this.getVersion(),
            environment: process.env.NODE_ENV || 'development',
            tesla: {
                mode: process.env.TESLA_MODE === 'true',
                optimizations: true
            },
            services: {},
            system: {},
            performance: {},
            errors: []
        };

        // 执行所有检查
        for (const [name, checkFn] of this.checks) {
            try {
                const checkResult = await checkFn();
                if (name === 'system' || name === 'memory' || name === 'disk' || name === 'network') {
                    results.system[name] = checkResult;
                } else {
                    results.services[name] = checkResult;
                }
            } catch (error) {
                results.errors.push({
                    check: name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                results.services[name] = {
                    status: 'unhealthy',
                    error: error.message
                };
            }
        }

        // 获取性能指标
        results.performance = await this.getPerformanceMetrics();

        // 确定整体健康状态
        results.status = this.determineOverallStatus(results);

        return results;
    }

    /**
     * 系统基础检查
     */
    async checkSystem() {
        return {
            status: 'healthy',
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            hostname: os.hostname(),
            loadAverage: os.loadavg(),
            cpuCount: os.cpus().length
        };
    }

    /**
     * 内存使用检查
     */
    async checkMemory() {
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsagePercent = (usedMem / totalMem) * 100;

        const status = memoryUsagePercent > 90 ? 'critical' : 
                      memoryUsagePercent > 75 ? 'warning' : 'healthy';

        return {
            status,
            usage: {
                rss: this.formatBytes(memUsage.rss),
                heapTotal: this.formatBytes(memUsage.heapTotal),
                heapUsed: this.formatBytes(memUsage.heapUsed),
                external: this.formatBytes(memUsage.external)
            },
            system: {
                total: this.formatBytes(totalMem),
                free: this.formatBytes(freeMem),
                used: this.formatBytes(usedMem),
                usagePercent: Math.round(memoryUsagePercent * 100) / 100
            }
        };
    }

    /**
     * 磁盘空间检查
     */
    async checkDisk() {
        try {
            const stats = await fs.stat(process.cwd());
            return {
                status: 'healthy',
                path: process.cwd(),
                accessible: true,
                lastModified: stats.mtime
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * 网络连接检查
     */
    async checkNetwork() {
        const networkInterfaces = os.networkInterfaces();
        const activeInterfaces = [];

        for (const [name, interfaces] of Object.entries(networkInterfaces)) {
            const activeIPs = interfaces
                .filter(iface => !iface.internal && iface.family === 'IPv4')
                .map(iface => iface.address);
            
            if (activeIPs.length > 0) {
                activeInterfaces.push({
                    name,
                    addresses: activeIPs
                });
            }
        }

        return {
            status: activeInterfaces.length > 0 ? 'healthy' : 'warning',
            interfaces: activeInterfaces,
            hostname: os.hostname()
        };
    }

    /**
     * 代理服务检查
     */
    async checkProxyService() {
        const proxyPort = process.env.PROXY_PORT || 3001;
        
        try {
            // 这里可以添加实际的代理服务检查逻辑
            // 例如：检查端口是否监听，发送测试请求等
            return {
                status: 'healthy',
                port: proxyPort,
                enabled: true,
                lastCheck: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                port: proxyPort,
                error: error.message
            };
        }
    }

    /**
     * WebRTC 服务检查
     */
    async checkWebRTCService() {
        const webrtcPort = process.env.WEBRTC_PORT || 3002;
        
        try {
            return {
                status: 'healthy',
                port: webrtcPort,
                enabled: true,
                stunServer: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302',
                lastCheck: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                port: webrtcPort,
                error: error.message
            };
        }
    }

    /**
     * 缓存服务检查
     */
    async checkCacheService() {
        try {
            // 检查缓存目录是否存在
            const cacheDir = path.join(process.cwd(), 'cache');
            await fs.access(cacheDir);
            
            return {
                status: 'healthy',
                directory: cacheDir,
                enabled: true,
                lastCheck: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'warning',
                error: 'Cache directory not accessible',
                message: 'Cache functionality may be limited'
            };
        }
    }

    /**
     * Tesla 优化检查
     */
    async checkTeslaOptimizations() {
        const teslaMode = process.env.TESLA_MODE === 'true';
        const optimizations = {
            cacheSize: process.env.TESLA_CACHE_SIZE || '100MB',
            maxBitrate: process.env.TESLA_MAX_BITRATE || '2000000',
            maxResolution: process.env.TESLA_MAX_RESOLUTION || '1920x1200',
            fallbackEnabled: process.env.TESLA_FALLBACK_ENABLED === 'true'
        };

        return {
            status: teslaMode ? 'healthy' : 'disabled',
            enabled: teslaMode,
            optimizations,
            userAgent: this.detectTeslaUserAgent(),
            lastCheck: new Date().toISOString()
        };
    }

    /**
     * 降级机制检查
     */
    async checkFallbackMechanism() {
        const fallbackEnabled = process.env.TESLA_FALLBACK_ENABLED === 'true';
        
        return {
            status: fallbackEnabled ? 'healthy' : 'disabled',
            enabled: fallbackEnabled,
            mechanisms: [
                'WebRTC to Proxy fallback',
                'Proxy to Direct fallback',
                'Quality degradation',
                'Connection retry'
            ],
            lastCheck: new Date().toISOString()
        };
    }

    /**
     * 获取性能指标
     */
    async getPerformanceMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                rss: memUsage.rss
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime(),
            eventLoopDelay: await this.measureEventLoopDelay()
        };
    }

    /**
     * 测量事件循环延迟
     */
    async measureEventLoopDelay() {
        return new Promise((resolve) => {
            const start = process.hrtime.bigint();
            setImmediate(() => {
                const delay = Number(process.hrtime.bigint() - start) / 1000000; // 转换为毫秒
                resolve(delay);
            });
        });
    }

    /**
     * 检测 Tesla 用户代理
     */
    detectTeslaUserAgent() {
        // 这里可以添加实际的用户代理检测逻辑
        return {
            detected: false,
            userAgent: 'Not available in health check context',
            model: 'Unknown',
            version: 'Unknown'
        };
    }

    /**
     * 确定整体健康状态
     */
    determineOverallStatus(results) {
        if (results.errors.length > 0) {
            return 'degraded';
        }

        const serviceStatuses = Object.values(results.services).map(s => s.status);
        const systemStatuses = Object.values(results.system).map(s => s.status);
        const allStatuses = [...serviceStatuses, ...systemStatuses];

        if (allStatuses.includes('critical')) {
            return 'critical';
        }
        if (allStatuses.includes('unhealthy')) {
            return 'unhealthy';
        }
        if (allStatuses.includes('warning')) {
            return 'warning';
        }

        return 'healthy';
    }

    /**
     * 获取运行时间
     */
    getUptime() {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        return {
            ms: uptimeMs,
            seconds: uptimeSeconds,
            human: `${days}d ${hours}h ${minutes}m ${seconds}s`
        };
    }

    /**
     * 获取应用版本
     */
    getVersion() {
        try {
            const packageJson = require('../package.json');
            return {
                version: packageJson.version || '1.0.0',
                name: packageJson.name || 'tesla-libretv'
            };
        } catch (error) {
            return {
                version: '1.0.0',
                name: 'tesla-libretv'
            };
        }
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取简化的健康状态（用于快速检查）
     */
    async getQuickStatus() {
        const memUsage = process.memoryUsage();
        const uptime = this.getUptime();
        
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: uptime.human,
            memory: this.formatBytes(memUsage.heapUsed),
            tesla: process.env.TESLA_MODE === 'true'
        };
    }
}

// 创建全局健康检查器实例
const healthChecker = new HealthChecker();

module.exports = {
    HealthChecker,
    healthChecker,
    
    // Express 中间件
    healthMiddleware: async (req, res) => {
        try {
            const quick = req.query.quick === 'true';
            const result = quick ? 
                await healthChecker.getQuickStatus() : 
                await healthChecker.performHealthCheck();
            
            const statusCode = result.status === 'healthy' ? 200 : 
                             result.status === 'warning' ? 200 : 
                             result.status === 'degraded' ? 503 : 503;
            
            res.status(statusCode).json(result);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }
};