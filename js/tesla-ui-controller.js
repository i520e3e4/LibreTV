/**
 * 特斯拉UI控制器
 * 负责管理特斯拉车机环境下的用户界面和交互
 */
class TeslaUIController {
    constructor(container, renderer, decoder) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.renderer = renderer;
        this.decoder = decoder;
        
        this.isControlsVisible = false;
        this.controlsTimeout = null;
        this.isDragging = false;
        this.volume = 0.8;
        this.currentTime = 0;
        this.duration = 0;
        
        this.init();
    }
    
    init() {
        this.createUI();
        this.bindEvents();
        this.startControlsAutoHide();
    }
    
    createUI() {
        // 清空容器
        this.container.innerHTML = '';
        
        // 创建主容器
        const playerContainer = document.createElement('div');
        playerContainer.className = 'tesla-player-container';
        
        // 创建Canvas容器
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'tesla-canvas-player';
        canvasContainer.id = 'tesla-canvas';
        
        // 创建加载动画
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'tesla-loading';
        loadingDiv.id = 'tesla-loading';
        loadingDiv.innerHTML = `
            <div class="tesla-loading-spinner"></div>
            <div class="tesla-loading-text">正在加载视频...</div>
            <div class="tesla-loading-subtitle">特斯拉行车观影模式</div>
        `;
        
        // 创建错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'tesla-error';
        errorDiv.id = 'tesla-error';
        errorDiv.style.display = 'none';
        
        // 创建行车指示器
        const drivingIndicator = document.createElement('div');
        drivingIndicator.className = 'tesla-driving-indicator';
        drivingIndicator.id = 'tesla-driving-indicator';
        drivingIndicator.textContent = '行车模式';
        
        // 创建手势提示
        const gestureHint = document.createElement('div');
        gestureHint.className = 'tesla-gesture-hint';
        gestureHint.id = 'tesla-gesture-hint';
        gestureHint.textContent = '点击播放/暂停';
        
        // 创建控制栏
        const controls = this.createControls();
        
        // 组装UI
        playerContainer.appendChild(canvasContainer);
        playerContainer.appendChild(loadingDiv);
        playerContainer.appendChild(errorDiv);
        playerContainer.appendChild(drivingIndicator);
        playerContainer.appendChild(gestureHint);
        playerContainer.appendChild(controls);
        
        this.container.appendChild(playerContainer);
        
        // 保存引用
        this.elements = {
            playerContainer,
            canvasContainer,
            loading: loadingDiv,
            error: errorDiv,
            drivingIndicator,
            gestureHint,
            controls
        };
    }
    
    createControls() {
        const controls = document.createElement('div');
        controls.className = 'tesla-controls';
        controls.id = 'tesla-controls';
        
        // 进度条容器
        const progressContainer = document.createElement('div');
        progressContainer.className = 'tesla-progress-container';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'tesla-progress-bar';
        progressBar.style.width = '0%';
        
        const progressThumb = document.createElement('div');
        progressThumb.className = 'tesla-progress-thumb';
        
        progressBar.appendChild(progressThumb);
        progressContainer.appendChild(progressBar);
        
        // 控制按钮容器
        const controlButtons = document.createElement('div');
        controlButtons.className = 'tesla-control-buttons';
        
        // 左侧控制
        const controlLeft = document.createElement('div');
        controlLeft.className = 'tesla-control-left';
        
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'tesla-time';
        timeDisplay.textContent = '00:00 / 00:00';
        
        controlLeft.appendChild(timeDisplay);
        
        // 中央控制
        const controlCenter = document.createElement('div');
        controlCenter.className = 'tesla-control-center';
        
        const prevBtn = this.createButton('⏮', 'tesla-btn', '上一集');
        const playBtn = this.createButton('▶', 'tesla-btn primary', '播放/暂停');
        const nextBtn = this.createButton('⏭', 'tesla-btn', '下一集');
        
        controlCenter.appendChild(prevBtn);
        controlCenter.appendChild(playBtn);
        controlCenter.appendChild(nextBtn);
        
        // 右侧控制
        const controlRight = document.createElement('div');
        controlRight.className = 'tesla-control-right';
        
        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'tesla-volume-container';
        
        const volumeBtn = this.createButton('🔊', 'tesla-btn', '音量');
        const volumeSlider = document.createElement('div');
        volumeSlider.className = 'tesla-volume-slider';
        
        const volumeBar = document.createElement('div');
        volumeBar.className = 'tesla-volume-bar';
        volumeBar.style.width = '80%';
        
        volumeSlider.appendChild(volumeBar);
        volumeContainer.appendChild(volumeBtn);
        volumeContainer.appendChild(volumeSlider);
        
        const fullscreenBtn = this.createButton('⛶', 'tesla-btn', '全屏');
        
        controlRight.appendChild(volumeContainer);
        controlRight.appendChild(fullscreenBtn);
        
        // 组装控制按钮
        controlButtons.appendChild(controlLeft);
        controlButtons.appendChild(controlCenter);
        controlButtons.appendChild(controlRight);
        
        // 组装控制栏
        controls.appendChild(progressContainer);
        controls.appendChild(controlButtons);
        
        // 保存控制元素引用
        this.controlElements = {
            progressContainer,
            progressBar,
            progressThumb,
            timeDisplay,
            playBtn,
            prevBtn,
            nextBtn,
            volumeBtn,
            volumeSlider,
            volumeBar,
            fullscreenBtn
        };
        
        return controls;
    }
    
    createButton(text, className, title) {
        const button = document.createElement('button');
        button.className = className;
        button.textContent = text;
        button.title = title;
        button.setAttribute('aria-label', title);
        return button;
    }
    
    bindEvents() {
        // Canvas点击事件
        this.elements.canvasContainer.addEventListener('click', () => {
            this.togglePlayPause();
            this.showGestureHint('点击播放/暂停');
        });
        
        // 鼠标移动显示控制栏
        this.elements.playerContainer.addEventListener('mousemove', () => {
            this.showControls();
        });
        
        // 触摸事件
        this.elements.playerContainer.addEventListener('touchstart', () => {
            this.showControls();
        });
        
        // 播放/暂停按钮
        this.controlElements.playBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        // 上一集/下一集
        this.controlElements.prevBtn.addEventListener('click', () => {
            this.emit('previousEpisode');
        });
        
        this.controlElements.nextBtn.addEventListener('click', () => {
            this.emit('nextEpisode');
        });
        
        // 进度条拖拽
        this.bindProgressEvents();
        
        // 音量控制
        this.bindVolumeEvents();
        
        // 全屏按钮
        this.controlElements.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
        
        // 解码器事件
        if (this.decoder) {
            this.decoder.on('timeupdate', (time, duration) => {
                this.updateProgress(time, duration);
            });
            
            this.decoder.on('play', () => {
                this.updatePlayButton(true);
                this.hideLoading();
            });
            
            this.decoder.on('pause', () => {
                this.updatePlayButton(false);
            });
            
            this.decoder.on('error', (error) => {
                this.showError(error.message);
            });
        }
    }
    
    bindProgressEvents() {
        const progressContainer = this.controlElements.progressContainer;
        
        const handleProgressClick = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const time = percent * this.duration;
            this.seek(time);
        };
        
        progressContainer.addEventListener('click', handleProgressClick);
        
        // 拖拽支持
        let isDragging = false;
        
        progressContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            handleProgressClick(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                handleProgressClick(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    bindVolumeEvents() {
        const volumeSlider = this.controlElements.volumeSlider;
        const volumeBtn = this.controlElements.volumeBtn;
        
        const handleVolumeClick = (e) => {
            const rect = volumeSlider.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.setVolume(Math.max(0, Math.min(1, percent)));
        };
        
        volumeSlider.addEventListener('click', handleVolumeClick);
        
        volumeBtn.addEventListener('click', () => {
            this.toggleMute();
        });
    }
    
    handleKeyboard(e) {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.seek(this.currentTime - 10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.seek(this.currentTime + 10);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.setVolume(Math.min(1, this.volume + 0.1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.setVolume(Math.max(0, this.volume - 0.1));
                break;
            case 'KeyF':
                e.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }
    
    // 控制方法
    togglePlayPause() {
        if (this.decoder) {
            if (this.decoder.isPlaying()) {
                this.decoder.pause();
            } else {
                this.decoder.play();
            }
        }
    }
    
    seek(time) {
        if (this.decoder) {
            this.decoder.seek(time);
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.decoder) {
            this.decoder.setVolume(this.volume);
        }
        this.updateVolumeDisplay();
    }
    
    toggleMute() {
        if (this.volume > 0) {
            this.previousVolume = this.volume;
            this.setVolume(0);
        } else {
            this.setVolume(this.previousVolume || 0.8);
        }
    }
    
    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            this.elements.playerContainer.requestFullscreen();
        }
    }
    
    // UI更新方法
    updateProgress(currentTime, duration) {
        this.currentTime = currentTime;
        this.duration = duration;
        
        const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
        this.controlElements.progressBar.style.width = percent + '%';
        
        const currentTimeStr = this.formatTime(currentTime);
        const durationStr = this.formatTime(duration);
        this.controlElements.timeDisplay.textContent = `${currentTimeStr} / ${durationStr}`;
    }
    
    updatePlayButton(isPlaying) {
        this.controlElements.playBtn.textContent = isPlaying ? '⏸' : '▶';
    }
    
    updateVolumeDisplay() {
        const percent = this.volume * 100;
        this.controlElements.volumeBar.style.width = percent + '%';
        
        // 更新音量图标
        let icon = '🔊';
        if (this.volume === 0) {
            icon = '🔇';
        } else if (this.volume < 0.5) {
            icon = '🔉';
        }
        this.controlElements.volumeBtn.textContent = icon;
    }
    
    showControls() {
        this.elements.controls.classList.add('show');
        this.isControlsVisible = true;
        this.startControlsAutoHide();
    }
    
    hideControls() {
        this.elements.controls.classList.remove('show');
        this.isControlsVisible = false;
    }
    
    startControlsAutoHide() {
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
        }
        
        this.controlsTimeout = setTimeout(() => {
            if (!this.isDragging) {
                this.hideControls();
            }
        }, 3000);
    }
    
    showLoading(text = '正在加载视频...') {
        this.elements.loading.querySelector('.tesla-loading-text').textContent = text;
        this.elements.loading.style.display = 'block';
    }
    
    hideLoading() {
        this.elements.loading.style.display = 'none';
    }
    
    showError(message) {
        this.elements.error.innerHTML = `
            <div class="tesla-error-title">播放错误</div>
            <div class="tesla-error-message">${message}</div>
        `;
        this.elements.error.style.display = 'block';
        this.hideLoading();
    }
    
    hideError() {
        this.elements.error.style.display = 'none';
    }
    
    showDrivingIndicator() {
        this.elements.drivingIndicator.classList.add('active');
    }
    
    hideDrivingIndicator() {
        this.elements.drivingIndicator.classList.remove('active');
    }
    
    showGestureHint(text) {
        this.elements.gestureHint.textContent = text;
        this.elements.gestureHint.classList.add('show');
        
        setTimeout(() => {
            this.elements.gestureHint.classList.remove('show');
        }, 2000);
    }
    
    // 工具方法
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    // 事件系统
    on(event, callback) {
        if (!this.events) {
            this.events = {};
        }
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }
    
    emit(event, ...args) {
        if (this.events && this.events[event]) {
            this.events[event].forEach(callback => {
                callback(...args);
            });
        }
    }
    
    // 销毁方法
    destroy() {
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
        }
        
        // 移除事件监听器
        document.removeEventListener('keydown', this.handleKeyboard);
        
        // 清空容器
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // 清理引用
        this.elements = null;
        this.controlElements = null;
        this.events = null;
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaUIController;
} else {
    window.TeslaUIController = TeslaUIController;
}