@echo off
echo ========================================
echo Tesla WebRTC信令服务器启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js环境检查通过
echo.

echo 进入服务器目录...
cd server

echo 检查依赖包...
if not exist node_modules (
    echo 正在安装依赖包...
    npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖包安装失败
        pause
        exit /b 1
    )
    echo 依赖包安装完成
    echo.
)

echo 启动WebRTC信令服务器...
echo 服务器将在 http://localhost:8080 启动
echo WebSocket信令地址: ws://localhost:8080/signal
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

node webrtc-signal-server.js

echo.
echo 服务器已停止
pause