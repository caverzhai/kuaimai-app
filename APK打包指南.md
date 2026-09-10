# 快卖 APP - 安卓APK打包指南

## 一、环境准备（必须先安装）

### 1. Node.js 18+
- 下载地址：https://nodejs.org/zh-cn/download/
- 选择 **LTS 版本**（推荐 20.x）
- 安装时勾选 "Add to PATH"
- 验证：打开命令行输入 `node --version`

### 2. Java JDK 17+
- 下载地址：https://adoptium.net/zh-CN/temurin/releases/
- 选择 **JDK 17 LTS**，Windows x64 版本
- 安装后配置环境变量：
  - 新建 `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`
  - 在 `Path` 中添加 `%JAVA_HOME%\bin`
- 验证：命令行输入 `java -version`

### 3. Android SDK（两种方式选一种）

#### 方式A：安装 Android Studio（推荐，最简单）
- 下载地址：https://developer.android.google.cn/studio
- 安装后打开 Android Studio，进入 **Settings → Languages & Frameworks → Android SDK**
- 勾选安装：
  - Android SDK Platform 34（或最新版）
  - Android SDK Build-Tools
  - Android SDK Platform-Tools
  - Android SDK Command-line Tools
- 配置环境变量：
  - 新建 `ANDROID_HOME` = `C:\Users\你的用户名\AppData\Local\Android\Sdk`
  - 在 `Path` 中添加：
    - `%ANDROID_HOME%\platform-tools`
    - `%ANDROID_HOME%\cmdline-tools\latest\bin`

#### 方式B：仅安装 Command Line Tools（体积小）
- 下载地址：https://developer.android.google.cn/studio#command-tools
- 解压到 `C:\Android\cmdline-tools\latest`
- 命令行执行：
  ```
  sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
  ```
- 配置环境变量同上

### 4. 验证环境
打开新的命令行窗口，依次执行：
```
node --version
java -version
echo %ANDROID_HOME%
```
都能正常输出版本号和路径，说明环境配置成功。

---

## 二、打包APK

### 方法一：一键打包（推荐）
1. 进入项目目录：`C:\Users\xiangya\Doubao\chats\2026-09-02\new-chat\kuaimai-app`
2. **双击运行 `build-apk.bat`**
3. 等待自动完成（首次运行需要下载依赖，约10-20分钟）
4. 构建成功后，APK 文件在：
   ```
   kuaimai-app\client\android\app\build\outputs\apk\debug\app-debug.apk
   ```

### 方法二：手动打包（适合调试）
```bash
# 1. 进入前端目录
cd client

# 2. 安装依赖（首次）
npm install

# 3. 构建前端
npm run build

# 4. 初始化 Android 项目（仅首次）
npx cap add android

# 5. 同步代码到 Android
npx cap sync android

# 6. 构建 APK
cd android
gradlew assembleDebug
```

---

## 三、安装到手机

1. 将 `app-debug.apk` 传到手机（微信/QQ/数据线均可）
2. 手机上点击 APK 文件安装
3. 如果提示"未知来源"，在设置中允许安装
4. 安装完成后桌面会出现"快卖"图标

---

## 四、重要配置修改

### 1. 修改后端API地址
打包成APP后，手机无法访问 localhost，必须修改为公网可访问的后端地址。

编辑文件：`client\.env`
```
VITE_API_BASE_URL=https://你的后端服务器地址
```
例如：
```
VITE_API_BASE_URL=https://api.kuaimai.com
```
修改后重新运行 `build-apk.bat`。

> **注意**：当前默认使用平台预览地址，仅用于测试。正式运营必须部署自己的后端服务器。

### 2. 修改APP名称和包名
编辑文件：`client\capacitor.config.ts`
```typescript
appId: 'com.kuaimai.app',    // 包名（上架应用商店需唯一）
appName: '快卖',               // APP名称
```

### 3. 修改APP图标
1. 准备一张 1024x1024 的 PNG 图标
2. 使用在线工具生成各尺寸图标：https://icon.kitchen/
3. 替换 `android/app/src/main/res/` 下的图标文件
4. 或使用 Android Studio 的 Image Asset Studio 生成

### 4. 构建 Release 版本（上架用）
```bash
cd client/android
gradlew assembleRelease
```
Release 版本需要签名，参考：https://developer.android.com/studio/publish/app-signing

---

## 五、常见问题

### Q1: 构建失败，提示 "SDK location not found"
A: 没有配置 ANDROID_HOME 环境变量，参考上面的 Android SDK 安装步骤。

### Q2: 构建失败，提示 "Could not find tools.jar"
A: 安装的是 JRE 而不是 JDK，请安装 JDK 17+ 并配置 JAVA_HOME。

### Q3: npm install 很慢或失败
A: 切换淘宝镜像：
```
npm config set registry https://registry.npmmirror.com
```

### Q4: APK安装后白屏或无法加载数据
A: 检查后端API地址是否配置正确，手机是否能访问该地址。

### Q5: 头像上传失败
A: 当前版本头像上传使用 base64 存储，如需云存储请配置自己的 OSS/COS 服务。

### Q6: 提示音不响
A: 浏览器/WebView 限制，需要用户先点击页面一次后才能播放声音，这是正常现象。

---

## 六、项目结构说明

```
kuaimai-app/
├── build-apk.bat              # 一键打包脚本（双击运行）
├── APK打包指南.md              # 本文件
├── client/                     # 前端项目
│   ├── package.json            # 前端依赖配置
│   ├── vite.config.ts          # Vite构建配置
│   ├── capacitor.config.ts     # Capacitor配置
│   ├── tsconfig.json           # TypeScript配置
│   ├── tailwind.config.js      # Tailwind CSS配置
│   ├── .env                    # 环境变量（API地址）
│   ├── index.html              # HTML入口
│   ├── public/                 # 静态资源
│   │   └── manifest.json       # PWA配置
│   ├── src/                    # 源代码
│   │   ├── pages/              # 页面组件
│   │   ├── components/         # 通用组件
│   │   ├── api/                # API调用
│   │   ├── contexts/           # React Context
│   │   ├── lib/                # 工具库（含平台SDK垫片）
│   │   └── utils/              # 工具函数
│   └── android/                # Android项目（首次构建后生成）
├── server/                     # 后端项目（NestJS）
│   ├── package.json
│   ├── main.ts
│   ├── database/schema.ts      # 数据库表结构
│   └── modules/                # 业务模块
└── shared/                     # 前后端共享类型定义
    └── api.interface.ts
```

---

## 七、技术支持

如遇构建问题，请检查：
1. Node.js 版本 ≥ 18
2. JDK 版本 ≥ 17
3. ANDROID_HOME 环境变量已配置
4. 网络可访问 npm 仓库和 Google Maven（如需可配置镜像）

构建成功后，APK 文件在 `client\android\app\build\outputs\apk\debug\` 目录下。
