/**
 * Tesla代理服务器
 * 用于绕过特斯拉车机的视频播放限制
 * 通过代理和转码技术实现视频流传输
 */

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const url = require('url');

class TeslaProxyServer {
    constructor(options = {}) {
        this.port = options.port || 3001;
        this.host = options.host || 'localhost';
        this.debug = options.debug || false;
        
        this.app = express();
        this.server = null;
        
        // 支持的视频格式
        this.supportedFormats = ['mp4', 'webm', 'ogg'];
        
        // 缓存目录
        this.cacheDir = path.join(__dirname, 'cache');
        this.ensureCacheDir();
        
        this.init();
    }
    
    /**
     * 初始化服务器
     */
    init() {
        try {
            // 基础中间件
            this.app.use(cors({
                origin: '*',
                methods: ['GET', 'POST', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'Range']
            }));
            
            this.app.use(express.json());
            this.app.use(express.urlencoded({ extended: true }));
            
            // 设置路由
            this.setupRoutes();
            
            this.log('Tesla代理服务器初始化完成');
            
        } catch (error) {
            this.log('服务器初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 设置路由
     */
    setupRoutes() {
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                server: 'Tesla Proxy Server'
            });
        });
        
        // 视频代理路由
        this.app.get('/proxy/video', this.handleVideoProxy.bind(this));
        
        // 视频转码路由
        this.app.get('/transcode/video', this.handleVideoTranscode.bind(this));
        
        // 流媒体代理路由
        this.app.get('/stream/:format', this.handleStreamProxy.bind(this));
        
        // 获取视频信息
        this.app.get('/info/video', this.handleVideoInfo.bind(this));
        
        // 清理缓存
        this.app.post('/cache/clear', this.handleCacheClear.bind(this));
        
        // 错误处理
        this.app.use(this.handleError.bind(this));
    }
    
    /**
     * 处理视频代理请求
     */
    async handleVideoProxy(req, res) {
        try {
            const { url: videoUrl, format } = req.query;
            
            if (!videoUrl) {
                return res.status(400).json({ error: '缺少视频URL参数' });
            }
            
            this.log(`代理视频请求: ${videoUrl}`);
            
            // 检查是否需要转码
            const needsTranscode = format && !this.supportedFormats.includes(format);
            
            if (needsTranscode) {
                return this.handleVideoTranscode(req, res);
            }
            
            // 直接代理
            const proxyMiddleware = createProxyMiddleware({
                target: videoUrl,
                changeOrigin: true,
                pathRewrite: () => '',
                onProxyReq: (proxyReq, req, res) => {
                    // 设置User-Agent伪装
                    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
                    proxyReq.setHeader('Referer', 'https://www.tesla.com/');
                },
                onProxyRes: (proxyRes, req, res) => {
                    // 设置CORS头
                    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
                    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
                    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Range';
                    
                    // 设置缓存头
                    proxyRes.headers['Cache-Control'] = 'public, max-age=3600';
                },
                onError: (err, req, res) => {
                    this.log('代理错误:', err.message);
                    res.status(500).json({ error: '代理请求失败', details: err.message });
                }
            });
            
            proxyMiddleware(req, res);
            
        } catch (error) {
            this.log('视频代理处理失败:', error);
            res.status(500).json({ error: '服务器内部错误', details: error.message });
        }
    }
    
    /**
     * 处理视频转码请求
     */
    async handleVideoTranscode(req, res) {
        try {
            const { url: videoUrl, format = 'mp4', quality = '720p' } = req.query;
            
            if (!videoUrl) {
                return res.status(400).json({ error: '缺少视频URL参数' });
            }
            
            this.log(`转码视频请求: ${videoUrl} -> ${format} (${quality})`);
            
            // 生成缓存文件名
            const cacheKey = this.generateCacheKey(videoUrl, format, quality);
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.${format}`);
            
            // 检查缓存
            if (fs.existsSync(cacheFile)) {
                this.log('使用缓存文件:', cacheFile);
                return this.streamFile(res, cacheFile, format);
            }
            
            // 开始转码
            this.transcodeVideo(videoUrl, cacheFile, format, quality)
                .then(() => {
                    this.log('转码完成:', cacheFile);
                    this.streamFile(res, cacheFile, format);
                })
                .catch(error => {
                    this.log('转码失败:', error);
                    res.status(500).json({ error: '视频转码失败', details: error.message });
                });
            
        } catch (error) {
            this.log('视频转码处理失败:', error);
            res.status(500).json({ error: '服务器内部错误', details: error.message });
        }
    }
    
    /**
     * 处理流媒体代理
     */
    async handleStreamProxy(req, res) {
        try {
            const { format } = req.params;
            const { url: streamUrl } = req.query;
            
            if (!streamUrl) {
                return res.status(400).json({ error: '缺少流媒体URL参数' });
            }
            
            this.log(`流媒体代理请求: ${streamUrl} (${format})`);
            
            // 设置流媒体响应头
            res.setHeader('Content-Type', this.getContentType(format));
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
            
            // 创建FFmpeg流
            const ffmpegCommand = ffmpeg(streamUrl)
                .format(format)
                .videoCodec('libx264')
                .audioCodec('aac')
                .size('1280x720')
                .videoBitrate('1000k')
                .audioBitrate('128k')
                .on('start', (commandLine) => {
                    this.log('FFmpeg命令:', commandLine);
                })
                .on('error', (err) => {
                    this.log('FFmpeg错误:', err.message);
                    if (!res.headersSent) {
                        res.status(500).json({ error: '流媒体处理失败', details: err.message });
                    }
                })
                .on('end', () => {
                    this.log('流媒体处理完成');
                });
            
            // 输出到响应流
            ffmpegCommand.pipe(res, { end: true });
            
        } catch (error) {
            this.log('流媒体代理处理失败:', error);
            res.status(500).json({ error: '服务器内部错误', details: error.message });
        }
    }
    
    /**
     * 处理视频信息请求
     */
    async handleVideoInfo(req, res) {
        try {
            const { url: videoUrl } = req.query;
            
            if (!videoUrl) {
                return res.status(400).json({ error: '缺少视频URL参数' });
            }
            
            this.log(`获取视频信息: ${videoUrl}`);
            
            // 使用FFprobe获取视频信息
            ffmpeg.ffprobe(videoUrl, (err, metadata) => {
                if (err) {
                    this.log('获取视频信息失败:', err.message);
                    return res.status(500).json({ error: '获取视频信息失败', details: err.message });
                }
                
                const videoInfo = {
                    duration: metadata.format.duration,
                    size: metadata.format.size,
                    bitrate: metadata.format.bit_rate,
                    format: metadata.format.format_name,
                    streams: metadata.streams.map(stream => ({
                        type: stream.codec_type,
                        codec: stream.codec_name,
                        width: stream.width,
                        height: stream.height,
                        fps: stream.r_frame_rate,
                        bitrate: stream.bit_rate
                    }))
                };
                
                res.json(videoInfo);
            });
            
        } catch (error) {
            this.log('视频信息处理失败:', error);
            res.status(500).json({ error: '服务器内部错误', details: error.message });
        }
    }
    
    /**
     * 处理缓存清理
     */
    async handleCacheClear(req, res) {
        try {
            this.log('清理缓存目录');
            
            const files = fs.readdirSync(this.cacheDir);
            let deletedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
            
            res.json({
                message: '缓存清理完成',
                deletedFiles: deletedCount
            });
            
        } catch (error) {
            this.log('缓存清理失败:', error);
            res.status(500).json({ error: '缓存清理失败', details: error.message });
        }
    }
    
    /**
     * 视频转码
     */
    transcodeVideo(inputUrl, outputPath, format, quality) {
        return new Promise((resolve, reject) => {
            const qualitySettings = {
                '480p': { size: '854x480', bitrate: '500k' },
                '720p': { size: '1280x720', bitrate: '1000k' },
                '1080p': { size: '1920x1080', bitrate: '2000k' }
            };
            
            const settings = qualitySettings[quality] || qualitySettings['720p'];
            
            ffmpeg(inputUrl)
                .format(format)
                .videoCodec('libx264')
                .audioCodec('aac')
                .size(settings.size)
                .videoBitrate(settings.bitrate)
                .audioBitrate('128k')
                .outputOptions([
                    '-preset fast',
                    '-crf 23',
                    '-movflags +faststart'
                ])
                .on('start', (commandLine) => {
                    this.log('开始转码:', commandLine);
                })
                .on('progress', (progress) => {
                    if (this.debug) {
                        this.log(`转码进度: ${Math.round(progress.percent || 0)}%`);
                    }
                })
                .on('end', () => {
                    this.log('转码完成:', outputPath);
                    resolve();
                })
                .on('error', (err) => {
                    this.log('转码失败:', err.message);
                    reject(err);
                })
                .save(outputPath);
        });
    }
    
    /**
     * 流式传输文件
     */
    streamFile(res, filePath, format) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        
        res.setHeader('Content-Type', this.getContentType(format));
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    }
    
    /**
     * 获取内容类型
     */
    getContentType(format) {
        const contentTypes = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'avi': 'video/x-msvideo',
            'mov': 'video/quicktime'
        };
        
        return contentTypes[format] || 'video/mp4';
    }
    
    /**
     * 生成缓存键
     */
    generateCacheKey(url, format, quality) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');
        hash.update(`${url}_${format}_${quality}`);
        return hash.digest('hex');
    }
    
    /**
     * 确保缓存目录存在
     */
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            this.log('创建缓存目录:', this.cacheDir);
        }
    }
    
    /**
     * 错误处理中间件
     */
    handleError(err, req, res, next) {
        this.log('服务器错误:', err.message);
        
        if (res.headersSent) {
            return next(err);
        }
        
        res.status(500).json({
            error: '服务器内部错误',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 启动服务器
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, this.host, (error) => {
                if (error) {
                    this.log('服务器启动失败:', error);
                    reject(error);
                } else {
                    this.log(`Tesla代理服务器启动成功: http://${this.host}:${this.port}`);
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
            if (this.server) {
                this.server.close(() => {
                    this.log('Tesla代理服务器已停止');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
    
    /**
     * 日志输出
     */
    log(...args) {
        if (this.debug) {
            console.log('[Tesla Proxy Server]', new Date().toISOString(), ...args);
        }
    }
    
    /**
     * 获取服务器状态
     */
    getStatus() {
        return {
            running: !!this.server,
            port: this.port,
            host: this.host,
            cacheDir: this.cacheDir,
            supportedFormats: this.supportedFormats
        };
    }
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
    const server = new TeslaProxyServer({
        port: process.env.PORT || 3001,
        host: process.env.HOST || '0.0.0.0',
        debug: true
    });
    
    server.start().then(() => {
        console.log('Tesla代理服务器运行中...');
    }).catch(error => {
        console.error('启动失败:', error);
        process.exit(1);
    });
    
    // 优雅关闭
    process.on('SIGINT', async () => {
        console.log('\n正在关闭服务器...');
        await server.stop();
        process.exit(0);
    });
}

module.exports = TeslaProxyServer;