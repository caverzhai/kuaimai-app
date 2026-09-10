-- 快卖 APP 数据库迁移脚本 v2.1.0
-- 添加咨询师相关字段

-- 咨询师级别（middle=中级，senior=高级，expert=特级）
ALTER TABLE users ADD COLUMN IF NOT EXISTS consultant_level VARCHAR(20) DEFAULT 'middle';

-- 服务介绍（200字以内）
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_introduction VARCHAR(500);

-- 真实姓名
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(50);

-- 微信号
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_id VARCHAR(100);

-- 身份证正面照片（非公开显示）
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_front_url TEXT;

-- 商品分类字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';

-- 商品单位
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '件';
