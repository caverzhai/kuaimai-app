@echo off
set JAVA_HOME=C:\Users\xiangya\Java\jdk-17
set ANDROID_HOME=C:\Users\xiangya\AppData\Local\Android\Sdk
set PATH=%PATH%;%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin
cd /d C:\Users\xiangya\Doubao\chats\2026-09-02\new-chat\kuaimai-app
call build-apk-auto.bat
