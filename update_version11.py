import json
import re

NEW_VERSION = '2.24.4'
NEW_VERSION_CODE = 106

base_path = r'C:\Users\xiangya\Doubao\chats\2026-09-02\new-chat\kuaimai-app'

# 1. client/package.json
with open(base_path + r'\client\package.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
data['version'] = NEW_VERSION
with open(base_path + r'\client\package.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# 2. build.gradle
with open(base_path + r'\client\android\app\build.gradle', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'versionCode \d+', f'versionCode {NEW_VERSION_CODE}', content)
content = re.sub(r'versionName "[^"]+"', f'versionName "{NEW_VERSION}"', content)
with open(base_path + r'\client\android\app\build.gradle', 'w', encoding='utf-8') as f:
    f.write(content)

# 3. version.ts
with open(base_path + r'\client\src\utils\version.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r"APP_VERSION = '[^']+'", f"APP_VERSION = '{NEW_VERSION}'", content)
content = re.sub(r'APP_VERSION_CODE = \d+', f'APP_VERSION_CODE = {NEW_VERSION_CODE}', content)
with open(base_path + r'\client\src\utils\version.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# 4. capacitor.config.ts
with open(base_path + r'\client\capacitor.config.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r"version: '[^']+'", f"version: '{NEW_VERSION}'", content)
with open(base_path + r'\client\capacitor.config.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# 5. version.json
with open(base_path + r'\server\public\version.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
data['version'] = NEW_VERSION
data['versionCode'] = NEW_VERSION_CODE
data['releaseNotes'] = '1. 管理员后台新增聊天室管理tab，可查看所有聊天室并手动删除\n2. 已结束超过24小时的聊天室自动彻底删除（含消息、成员、麦位）\n3. 个人资料页取消收货信息，改用实名认证的地址和姓名\n4. 未上传身份证的用户不能进行升级任务'
with open(base_path + r'\server\public\version.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'All version files updated to {NEW_VERSION} (versionCode={NEW_VERSION_CODE})')
