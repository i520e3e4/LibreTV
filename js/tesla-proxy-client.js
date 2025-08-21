/**
 * Tesla代理客户端
 * 用于与Tesla代理服务器通信，实现视频代理和转码功能
 */

class TeslaProxyClient {
    constructor(options = {}) {
        this.proxyServerUrl = options.proxyServerUrl || 'http://localhost:3001';
        this.debug = options.debug || false;
        this.timeout = options.timeout || 30000; // 30秒超时
        
        // 回调函数
        this.onProgress = options.onProgress || (() => {});
        this.onError = options.onError || (() => {});
        this.onSuccess = options.onSuccess || (() => {});
        
        this.log('Tesla代理客户端初始化完成');
    }
    
    /**
     * 检查代理服务器状态
     */
    async checkServerStatus() {
        try {
            const response = await fetch(`${this.proxyServerUrl}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            
            const data = await response.json();
            this.log('代理服务器状态:', data);
            
            return {
                online: true,
                status: data
            };
            
        } catch (error) {
            this.log('代理服务器离线:', error.message);
            return {
                online: false,
                error: error.message
            };
        }
    }
    
    /**
     * 代理视频URL
     */
    getProxyVideoUrl(originalUrl, options = {}) {
        const params = new URLSearchParams({
            url: originalUrl,
            ...options
        });
        
        const proxyUrl = `${this.proxyServerUrl}/proxy/video?${params.toString()}`;
        this.log('生成代理URL:', proxyUrl);
        
        return proxyUrl;
    }
    
    /**
     * 获取转码视频URL
     */
    getTranscodeVideoUrl(originalUrl, options = {}) {
        const {
            format = 'mp4',
            quality = '720p'
        } = options;
        
        const params = new URLSearchParams({
            url: originalUrl,
            format,
            quality
        });
        
        const transcodeUrl = `${this.proxyServerUrl}/transcode/video?${params.toString()}`;
        this.log('生成转码URL:', transcodeUrl);
        
        return transcodeUrl;
    }
    
    /**
     * 获取流媒体URL
     */
    getStreamUrl(originalUrl, format = 'mp4') {
        const params = new URLSearchParams({
            url: originalUrl
        });
        
        const streamUrl = `${this.proxyServerUrl}/stream/${format}?${params.toString()}`;
        this.log('生成流媒体URL:', streamUrl);
        
        return streamUrl;
    }
    
    /**
     * 获取视频信息
     */
    async getVideoInfo(videoUrl) {
        try {
            const params = new URLSearchParams({ url: videoUrl });
            const response = await fetch(`${this.proxyServerUrl}/info/video?${params.toString()}`, {
                method: 'GET',
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`获取视频信息失败: ${response.status}`);
            }
            
            const videoInfo = await response.json();
            this.log('视频信息:', videoInfo);
            
            return videoInfo;
            
        } catch (error) {
            this.log('获取视频信息失败:', error);
            this.onError(error);
            throw error;
        }
    }
    
    /**
     * 清理缓存
     */
    async clearCache() {
        try {
            const response = await fetch(`${this.proxyServerUrl}/cache/clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`清理缓存失败: ${response.status}`);
            }
            
            const result = await response.json();
            this.log('缓存清理结果:', result);
            
            return result;
            
        } catch (error) {
            this.log('清理缓存失败:', error);
            this.onError(error);
            throw error;
        }
    }
    
    /**
     * 创建视频元素并设置代理URL
     */
    createProxyVideo(originalUrl, container, options = {}) {
        const {
            useTranscode = false,
            format = 'mp4',
            quality = '720p',
            controls = true,
            autoplay = false,
            muted = false
        } = options;
        
        // 创建video元素
        const video = document.createElement('video');
        video.controls = controls;
        video.autoplay = autoplay;
        video.muted = muted;
        video.style.width = '100%';
        video.style.height = 'auto';
        
        // 设置视频源
        const videoUrl = useTranscode 
            ? this.getTranscodeVideoUrl(originalUrl, { format, quality })
            : this.getProxyVideoUrl(originalUrl, { format });
            
        video.src = videoUrl;
        
        // 添加事件监听
        video.addEventListener('loadstart', () => {
            this.log('开始加载视频');
            this.onProgress({ type: 'loadstart', message: '开始加载视频' });
        });
        
        video.addEventListener('loadedmetadata', () => {
            this.log('视频元数据加载完成');
            this.onProgress({ type: 'metadata', message: '视频元数据加载完成' });
        });
        
        video.addEventListener('canplay', () => {
            this.log('视频可以播放');
            this.onProgress({ type: 'canplay', message: '视频可以播放' });
        });
        
        video.addEventListener('canplaythrough', () => {
            this.log('视频可以流畅播放');
            this.onSuccess({ type: 'ready', message: '视频准备就绪' });
        });
        
        video.addEventListener('error', (event) => {
            const error = new Error(`视频加载错误: ${event.target.error?.message || '未知错误'}`);
            this.log('视频加载错误:', error);
            this.onError(error);
        });
        
        video.addEventListener('progress', () => {
            if (video.buffered.length > 0) {
                const buffered = video.buffered.end(video.buffered.length - 1);
                const duration = video.duration;
                const percent = duration ? (buffered / duration) * 100 : 0;
                
                this.onProgress({ 
                    type: 'buffer', 
                    percent, 
                    buffered, 
                    duration,
                    message: `缓冲进度: ${Math.round(percent)}%`
                });
            }
        });
        
        // 添加到容器
        if (container) {
            if (typeof container === 'string') {
                const element = document.querySelector(container);
                if (element) {
                    element.appendChild(video);
                }
            } else {
                container.appendChild(video);
            }
        }
        
        return video;
    }
    
    /**
     * 测试代理功能
     */
    async testProxy(testVideoUrl) {
        try {
            this.log('开始测试代理功能');
            
            // 1. 检查服务器状态
            const serverStatus = await this.checkServerStatus();
            if (!serverStatus.online) {
                throw new Error('代理服务器离线');
            }
            
            // 2. 获取视频信息
            const videoInfo = await this.getVideoInfo(testVideoUrl);
            
            // 3. 测试代理URL
            const proxyUrl = this.getProxyVideoUrl(testVideoUrl);
            const proxyResponse = await fetch(proxyUrl, { method: 'HEAD' });
            
            if (!proxyResponse.ok) {
                throw new Error(`代理URL测试失败: ${proxyResponse.status}`);
            }
            
            // 4. 测试转码URL
            const transcodeUrl = this.getTranscodeVideoUrl(testVideoUrl, { format: 'mp4', quality: '720p' });
            
            const testResult = {
                serverOnline: true,
                videoInfo,
                proxyUrl,
                transcodeUrl,
                proxyStatus: proxyResponse.status,
                timestamp: new Date().toISOString()
            };
            
            this.log('代理功能测试完成:', testResult);
            this.onSuccess({ type: 'test', result: testResult });
            
            return testResult;
            
        } catch (error) {
            this.log('代理功能测试失败:', error);
            this.onError(error);
            throw error;
        }
    }
    
    /**
     * 自动选择最佳播放方案
     */
    async getBestPlaybackOption(videoUrl) {
        try {
            // 检查服务器状态
            const serverStatus = await this.checkServerStatus();
            
            if (!serverStatus.online) {
                return {
                    method: 'direct',
                    url: videoUrl,
                    reason: '代理服务器离线，使用直接播放'
                };
            }
            
            // 获取视频信息
            let videoInfo;
            try {
                videoInfo = await this.getVideoInfo(videoUrl);
            } catch (error) {
                return {
                    method: 'direct',
                    url: videoUrl,
                    reason: '无法获取视频信息，使用直接播放'
                };
            }
            
            // 根据视频信息选择最佳方案
            const hasVideoStream = videoInfo.streams?.some(s => s.type === 'video');
            const videoStream = videoInfo.streams?.find(s => s.type === 'video');
            
            if (!hasVideoStream) {
                return {
                    method: 'direct',
                    url: videoUrl,
                    reason: '非视频文件，使用直接播放'
                };
            }
            
            // 检查是否需要转码
            const needsTranscode = (
                videoStream.codec !== 'h264' || 
                videoStream.width > 1920 || 
                videoInfo.format?.includes('mkv')
            );
            
            if (needsTranscode) {
                return {
                    method: 'transcode',
                    url: this.getTranscodeVideoUrl(videoUrl, { format: 'mp4', quality: '720p' }),
                    reason: '需要转码以确保兼容性'
                };
            } else {
                return {
                    method: 'proxy',
                    url: this.getProxyVideoUrl(videoUrl),
                    reason: '使用代理绕过限制'
                };
            }
            
        } catch (error) {
            this.log('选择播放方案失败:', error);
            return {
                method: 'direct',
                url: videoUrl,
                reason: `选择失败，使用直接播放: ${error.message}`
            };
        }
    }
    
    /**
     * 日志输出
     */
    log(...args) {
        if (this.debug) {
            console.log('[Tesla Proxy Client]', new Date().toISOString(), ...args);
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaProxyClient;
} else if (typeof window !== 'undefined') {
    window.TeslaProxyClient = TeslaProxyClient;
}