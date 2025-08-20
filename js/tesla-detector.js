/**
 * Tesla车机环境检测模块
 * 用于检测特斯拉车机浏览器环境和行车状态
 */

class TeslaDetector {
    constructor() {
        this.isTesla = false;
        this.isDriving = false;
        this.teslaVersion = null;
        this.init();
    }

    /**
     * 初始化检测
     */
    init() {
        this.detectTeslaEnvironment();
        this.detectDrivingState();
        this.setupDrivingStateMonitor();
    }

    /**
     * 检测是否为特斯拉车机环境
     */
    detectTeslaEnvironment() {
        const userAgent = navigator.userAgent;
        
        // 检测特斯拉车机的User-Agent特征
        const teslaPatterns = [
            /Tesla/i,
            /QtCarBrowser/i,
            /Tesla.*Browser/i,
            /Model[SXY3]/i
        ];

        this.isTesla = teslaPatterns.some(pattern => pattern.test(userAgent));

        // 检测特斯拉特有的API或对象
        if (!this.isTesla) {
            this.isTesla = this.checkTeslaAPIs();
        }

        // 检测屏幕分辨率（特斯拉车机常见分辨率）
        if (!this.isTesla) {
            this.isTesla = this.checkTeslaScreenResolution();
        }

        console.log('Tesla环境检测结果:', this.isTesla);
    }

    /**
     * 检测特斯拉特有的API
     */
    checkTeslaAPIs() {
        // 检测可能的特斯拉特有对象或方法
        const teslaAPIs = [
            'window.tesla',
            'window.TeslaAPI',
            'window.vehicle',
            'navigator.tesla'
        ];

        return teslaAPIs.some(api => {
            try {
                return eval(api) !== undefined;
            } catch (e) {
                return false;
            }
        });
    }

    /**
     * 检测特斯拉车机屏幕分辨率
     */
    checkTeslaScreenResolution() {
        const width = screen.width;
        const height = screen.height;
        
        // 特斯拉车机常见分辨率
        const teslaResolutions = [
            { w: 1920, h: 1200 }, // Model S/X
            { w: 1920, h: 1080 }, // Model 3/Y
            { w: 2200, h: 1300 }, // 新版Model S/X
            { w: 1280, h: 800 }   // 较老版本
        ];

        return teslaResolutions.some(res => 
            (width === res.w && height === res.h) || 
            (width === res.h && height === res.w)
        );
    }

    /**
     * 检测行车状态
     */
    detectDrivingState() {
        if (!this.isTesla) {
            this.isDriving = false;
            return;
        }

        // 方法1: 检测video标签是否被禁用
        this.isDriving = this.checkVideoTagDisabled();

        // 方法2: 检测特斯拉特有的行车状态API
        if (!this.isDriving) {
            this.isDriving = this.checkTeslaDrivingAPI();
        }

        // 方法3: 通过媒体播放限制检测
        if (!this.isDriving) {
            this.isDriving = this.checkMediaPlaybackRestrictions();
        }

        console.log('行车状态检测结果:', this.isDriving);
    }

    /**
     * 检测video标签是否被禁用
     */
    checkVideoTagDisabled() {
        try {
            const testVideo = document.createElement('video');
            testVideo.style.display = 'none';
            document.body.appendChild(testVideo);
            
            // 尝试设置视频源
            testVideo.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWF2YzEAAAAIZnJlZQAAABBtZGF0';
            
            const canPlay = testVideo.canPlayType('video/mp4');
            document.body.removeChild(testVideo);
            
            // 如果无法播放，可能是行车状态
            return canPlay === '';
        } catch (e) {
            return true; // 如果出错，假设是行车状态
        }
    }

    /**
     * 检测特斯拉行车状态API
     */
    checkTeslaDrivingAPI() {
        try {
            // 检测可能的特斯拉行车状态API
            if (window.tesla && window.tesla.vehicle) {
                return window.tesla.vehicle.isDriving || false;
            }
            if (window.vehicle && window.vehicle.state) {
                return window.vehicle.state.driving || false;
            }
        } catch (e) {
            console.log('Tesla API检测失败:', e);
        }
        return false;
    }

    /**
     * 检测媒体播放限制
     */
    checkMediaPlaybackRestrictions() {
        try {
            // 检测是否有媒体播放限制
            const audio = new Audio();
            const promise = audio.play();
            
            if (promise && promise.catch) {
                promise.catch(error => {
                    if (error.name === 'NotAllowedError') {
                        this.isDriving = true;
                    }
                });
            }
        } catch (e) {
            return true;
        }
        return false;
    }

    /**
     * 设置行车状态监控
     */
    setupDrivingStateMonitor() {
        if (!this.isTesla) return;

        // 定期检测行车状态变化
        setInterval(() => {
            const previousState = this.isDriving;
            this.detectDrivingState();
            
            if (previousState !== this.isDriving) {
                this.onDrivingStateChange(this.isDriving);
            }
        }, 5000); // 每5秒检测一次

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.detectDrivingState(), 1000);
            }
        });
    }

    /**
     * 行车状态变化回调
     */
    onDrivingStateChange(isDriving) {
        console.log('行车状态变化:', isDriving ? '开始行车' : '停止行车');
        
        // 触发自定义事件
        const event = new CustomEvent('teslaDrivingStateChange', {
            detail: { isDriving, isTesla: this.isTesla }
        });
        window.dispatchEvent(event);
    }

    /**
     * 获取当前状态
     */
    getState() {
        return {
            isTesla: this.isTesla,
            isDriving: this.isDriving,
            teslaVersion: this.teslaVersion,
            needsCustomRenderer: this.isTesla && this.isDriving
        };
    }

    /**
     * 是否需要使用自定义渲染器
     */
    needsCustomRenderer() {
        return this.isTesla && this.isDriving;
    }
}

// 创建全局实例
window.teslaDetector = new TeslaDetector();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaDetector;
}