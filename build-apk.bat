@echo off
chcp 65001 >nul
title 快卖 APP - 安卓APK一键打包工具

echo ========================================
echo    快卖 APP - 安卓APK一键打包工具
echo ========================================
echo.

:: 检查 Node.js
echo [1/6] 检查 Node.js 环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js 已安装: 
node --version
echo.

:: 检查 Java JDK
echo [2/6] 检查 Java JDK 环境...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Java JDK，请先安装 JDK 17+
    echo 下载地址: https://adoptium.net/
    echo 安装后请配置 JAVA_HOME 环境变量
    pause
    exit /b 1
)
echo [OK] Java 已安装:
java -version 2>&1 | findstr /i "version"
echo.

:: 检查 Android SDK
echo [3/6] 检查 Android SDK 环境...
if "%ANDROID_HOME%"=="" (
    if "%ANDROID_SDK_ROOT%"=="" (
        echo [错误] 未检测到 Android SDK
        echo 请安装 Android Studio 或 Command Line Tools
        echo 下载地址: https://developer.android.com/studio
        echo 安装后请配置 ANDROID_HOME 环境变量
        pause
        exit /b 1
    ) else (
        set ANDROID_HOME=%ANDROID_SDK_ROOT%
    )
)
echo [OK] Android SDK: %ANDROID_HOME%
echo.

:: 进入 client 目录
cd /d "%~dp0client"

:: 安装依赖
echo [4/6] 安装项目依赖（首次运行较慢，请耐心等待）...
if not exist "node_modules" (
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [跳过] node_modules 已存在
)
echo.

:: 构建前端
echo [5/6] 构建前端项目...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
echo [OK] 前端构建完成
echo.

:: 初始化或同步 Android 项目
echo [6/6] 同步并构建 Android APK...
if not exist "android" (
    echo 首次运行，正在初始化 Android 项目...
    call npx cap add android
    if %errorlevel% neq 0 (
        echo [错误] Android 项目初始化失败
        pause
        exit /b 1
    )
)

echo 同步前端代码到 Android 项目...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [错误] 同步失败
    pause
    exit /b 1
)

echo 构建 APK（debug版本）...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo [错误] APK 构建失败
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo    构建成功！
echo ========================================
echo.
echo APK 文件位置:
echo %~dp0client\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo 将此 APK 文件传到手机安装即可使用
echo.
pause
