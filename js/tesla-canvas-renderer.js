/**
 * Tesla Canvas视频渲染器
 * 使用Canvas+WebGL绕过特斯拉车机的video标签限制
 */

class TeslaCanvasRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            width: options.width || 1920,
            height: options.height || 1080,
            fps: options.fps || 30,
            enableWebGL: options.enableWebGL !== false,
            enableAudio: options.enableAudio !== false,
            ...options
        };
        
        this.canvas = null;
        this.ctx = null;
        this.gl = null;
        this.isWebGL = false;
        this.isPlaying = false;
        this.currentFrame = 0;
        this.frameBuffer = [];
        this.audioContext = null;
        this.audioBuffer = null;
        
        this.init();
    }

    /**
     * 初始化渲染器
     */
    init() {
        this.createCanvas();
        this.setupWebGL();
        this.setupAudio();
        this.setupEventHandlers();
    }

    /**
     * 创建Canvas元素
     */
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';
        this.canvas.style.backgroundColor = '#000';
        
        // 添加播放器控制属性
        this.canvas.setAttribute('data-tesla-player', 'true');
        this.canvas.setAttribute('tabindex', '0');
        
        this.container.appendChild(this.canvas);
    }

    /**
     * 设置WebGL上下文
     */
    setupWebGL() {
        if (!this.options.enableWebGL) {
            this.setupCanvas2D();
            return;
        }

        try {
            this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
            
            if (this.gl) {
                this.isWebGL = true;
                this.initWebGLShaders();
                this.initWebGLBuffers();
                console.log('WebGL渲染器初始化成功');
            } else {
                this.setupCanvas2D();
            }
        } catch (e) {
            console.warn('WebGL初始化失败，回退到Canvas 2D:', e);
            this.setupCanvas2D();
        }
    }

    /**
     * 设置Canvas 2D上下文
     */
    setupCanvas2D() {
        this.ctx = this.canvas.getContext('2d');
        this.isWebGL = false;
        console.log('Canvas 2D渲染器初始化成功');
    }

    /**
     * 初始化WebGL着色器
     */
    initWebGLShaders() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            uniform sampler2D u_texture;
            varying vec2 v_texCoord;
            
            void main() {
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }
        `;

        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        this.program = this.createProgram(vertexShader, fragmentShader);
        this.gl.useProgram(this.program);
        
        // 获取属性和uniform位置
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.textureLocation = this.gl.getUniformLocation(this.program, 'u_texture');
    }

    /**
     * 创建着色器
     */
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('着色器编译错误:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    /**
     * 创建程序
     */
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('程序链接错误:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }

    /**
     * 初始化WebGL缓冲区
     */
    initWebGLBuffers() {
        // 顶点位置
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);
        
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        
        // 纹理坐标
        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0
        ]);
        
        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
        
        // 创建纹理
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    /**
     * 设置音频上下文
     */
    setupAudio() {
        if (!this.options.enableAudio) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            console.log('音频上下文初始化成功');
        } catch (e) {
            console.warn('音频上下文初始化失败:', e);
        }
    }

    /**
     * 设置事件处理器
     */
    setupEventHandlers() {
        // 点击播放/暂停
        this.canvas.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });
        
        // 键盘控制
        this.canvas.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (this.isPlaying) {
                        this.pause();
                    } else {
                        this.play();
                    }
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.seek(-10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.seek(10);
                    break;
            }
        });
        
        // 触摸控制
        let touchStartX = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchEndX - touchStartX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.seek(10); // 向右滑动快进
                } else {
                    this.seek(-10); // 向左滑动快退
                }
            }
        });
    }

    /**
     * 渲染视频帧
     */
    renderFrame(frameData) {
        if (!frameData) return;
        
        if (this.isWebGL) {
            this.renderFrameWebGL(frameData);
        } else {
            this.renderFrameCanvas2D(frameData);
        }
    }

    /**
     * WebGL渲染帧
     */
    renderFrameWebGL(frameData) {
        const gl = this.gl;
        
        // 设置视口
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // 清除画布
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // 绑定纹理数据
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        if (frameData instanceof ImageData) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frameData);
        } else if (frameData instanceof HTMLImageElement || frameData instanceof HTMLCanvasElement) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frameData);
        } else {
            // 假设是原始像素数据
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.options.width, this.options.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, frameData);
        }
        
        // 绑定位置缓冲区
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        // 绑定纹理坐标缓冲区
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        
        // 设置纹理单元
        gl.uniform1i(this.textureLocation, 0);
        
        // 绘制
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     * Canvas 2D渲染帧
     */
    renderFrameCanvas2D(frameData) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (frameData instanceof ImageData) {
            this.ctx.putImageData(frameData, 0, 0);
        } else if (frameData instanceof HTMLImageElement || frameData instanceof HTMLCanvasElement) {
            this.ctx.drawImage(frameData, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // 处理原始像素数据
            const imageData = new ImageData(new Uint8ClampedArray(frameData), this.options.width, this.options.height);
            this.ctx.putImageData(imageData, 0, 0);
        }
    }

    /**
     * 播放音频
     */
    playAudio(audioData) {
        if (!this.audioContext || !audioData) return;
        
        try {
            this.audioContext.decodeAudioData(audioData.slice(), (buffer) => {
                const source = this.audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(this.gainNode);
                source.start();
            });
        } catch (e) {
            console.warn('音频播放失败:', e);
        }
    }

    /**
     * 开始播放
     */
    play() {
        this.isPlaying = true;
        this.canvas.setAttribute('data-playing', 'true');
        
        // 触发播放事件
        this.dispatchEvent('play');
    }

    /**
     * 暂停播放
     */
    pause() {
        this.isPlaying = false;
        this.canvas.setAttribute('data-playing', 'false');
        
        // 触发暂停事件
        this.dispatchEvent('pause');
    }

    /**
     * 跳转到指定时间
     */
    seek(seconds) {
        // 触发跳转事件
        this.dispatchEvent('seek', { seconds });
    }

    /**
     * 设置音量
     */
    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * 获取Canvas元素
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * 调整大小
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        
        if (this.isWebGL) {
            this.gl.viewport(0, 0, width, height);
        }
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        this.canvas = null;
        this.ctx = null;
        this.gl = null;
    }

    /**
     * 触发自定义事件
     */
    dispatchEvent(type, detail = {}) {
        const event = new CustomEvent(`teslaRenderer${type}`, {
            detail: { ...detail, renderer: this }
        });
        window.dispatchEvent(event);
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeslaCanvasRenderer;
} else {
    window.TeslaCanvasRenderer = TeslaCanvasRenderer;
}