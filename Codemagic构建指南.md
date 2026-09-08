# 快卖APP - Codemagic云构建指南

## 一、准备工作

### 1. 注册GitHub账号（如果没有）
- 访问 https://github.com 注册
- 记住你的用户名

### 2. 注册Apple开发者账号（必须，$99/年）
- 访问 https://developer.apple.com/programs/ 注册
- 需要：身份证、信用卡、能接收短信的手机号
- 审核通常1-3天

### 3. 注册Codemagic账号
- 访问 https://codemagic.io 注册
- 可以用GitHub账号直接登录
- 免费额度：每月500分钟构建时间

---

## 二、把代码推送到GitHub

### 方法一：用GitHub Desktop（推荐，简单）

1. 下载安装 GitHub Desktop：https://desktop.github.com
2. 打开GitHub Desktop，登录你的GitHub账号
3. 点击 "File" → "Add Local Repository"
4. 选择项目文件夹：`C:\Users\xiangya\Doubao\chats\2026-09-02\new-chat\kuaimai-app`
5. 点击 "Publish repository"
6. 填写仓库名称（如 `kuaimai-app`），选择 Public 或 Private
7. 点击 "Publish Repository"

### 方法二：用命令行

1. 在GitHub上创建新仓库（不要勾选README、.gitignore等）
2. 复制仓库地址（如 `https://github.com/你的用户名/kuaimai-app.git`）
3. 在项目目录执行：
```bash
git remote add origin https://github.com/你的用户名/kuaimai-app.git
git branch -M main
git push -u origin main
```

---

## 三、在Codemagic上配置构建

### 1. 连接GitHub仓库
1. 登录 https://codemagic.io
2. 点击 "Add application"
3. 选择 "GitHub"
4. 授权Codemagic访问你的GitHub仓库
5. 选择 `kuaimai-app` 仓库
6. 点击 "Finish"

### 2. 配置Apple开发者账号签名

**这是最关键的一步，必须配置才能构建.ipa**

1. 在Codemagic左侧菜单点击 "Teams" → 你的团队名称
2. 点击 "Developer portal" 标签
3. 点击 "Add" → "App Store Connect API key"
4. 按照提示操作：
   - 登录 https://appstoreconnect.apple.com/access/api
   - 点击 "生成API密钥"
   - 输入名称（如 `Codemagic`），角色选择 "App Manager"
   - 点击 "生成"，下载 `.p8` 密钥文件
   - 复制 Issuer ID 和 Key ID
5. 回到Codemagic，填写：
   - Issuer ID
   - Key ID
   - 上传 `.p8` 密钥文件
6. 点击 "Save"

### 3. 配置Bundle ID
1. 登录 https://developer.apple.com/account/resources/identifiers/list
2. 点击 "+" 创建新的App ID
3. 选择 "App IDs" → "App"
4. 填写：
   - Description: `快卖APP`
   - Bundle ID: `com.kuaimai.app`（必须和codemagic.yaml一致）
5. 勾选需要的能力（Push Notifications等）
6. 点击 "Continue" → "Register"

### 4. 触发构建
1. 回到Codemagic应用页面
2. 选择工作流：`ios-build`（iOS）或 `android-build`（Android）
3. 点击 "Start new build"
4. 选择分支 `main`
5. 点击 "Start new build"

---

## 四、构建完成后下载

1. 构建成功后，在构建详情页面
2. 找到 "Artifacts" 部分
3. 下载 `.ipa` 文件（iOS）或 `.apk` 文件（Android）
4. iOS的.ipa需要安装到测试设备：
   - 用Xcode → Window → Devices and Simulators
   - 连接iPhone，拖入.ipa安装
   - 或者用TestFlight（需要先上传到App Store Connect）

---

## 五、常见问题

### Q: 构建失败，提示代码签名错误
A: 检查Apple开发者账号是否正确配置，Bundle ID是否在开发者后台创建

### Q: iOS构建时间很长
A: 正常，首次构建需要15-30分钟（安装依赖、编译等）

### Q: 免费额度用完了怎么办
A: Codemagic免费额度是每月500分钟，iOS构建一次约15-20分钟，每月可以构建25-30次

### Q: 可以只构建Android吗
A: 可以，选择 `android-build` 工作流，不需要Apple开发者账号

### Q: 构建的.ipa可以直接发给用户安装吗
A: 不能直接安装，需要：
   - 用TestFlight（推荐，需要上传到App Store Connect）
   - 或者用Ad Hoc分发（需要在开发者后台添加测试设备UDID）
   - 或者上架App Store（需要审核）

---

## 六、文件说明

- `codemagic.yaml` - Codemagic构建配置文件（已创建）
- `.gitignore` - Git忽略文件（已创建）
- `client/ios/App/App.xcworkspace` - iOS Xcode项目（已生成）

---

## 七、下一步

1. ✅ 代码已提交到本地Git
2. ⏳ 推送到GitHub（需要你操作）
3. ⏳ 注册Codemagic并连接仓库
4. ⏳ 配置Apple开发者账号签名
5. ⏳ 触发构建，下载.ipa

有任何问题随时问我！
