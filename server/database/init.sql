-- 快卖 APP 数据库初始化脚本
-- 在 Railway PostgreSQL 中执行此脚本

-- 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  nickname VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  gender VARCHAR(10),
  level VARCHAR(20) NOT NULL DEFAULT 'junior',
  is_invited BOOLEAN NOT NULL DEFAULT false,
  inviter_id UUID,
  parent_id UUID,
  invite_code VARCHAR(20) UNIQUE,
  receive_address TEXT,
  receive_phone VARCHAR(20),
  industry VARCHAR(100),
  qualification TEXT,
  service_standard TEXT,
  wechat_qrcode_url TEXT,
  alipay_qrcode_url TEXT,
  company_qrcode_url TEXT,
  business_license_url TEXT,
  company_audit_status VARCHAR(20) DEFAULT 'none',
  total_consult_income NUMERIC NOT NULL DEFAULT 0,
  threshold_blocked BOOLEAN NOT NULL DEFAULT false,
  threshold_triggered_at TIMESTAMPTZ(3),
  pending_reclaim_amount NUMERIC NOT NULL DEFAULT 0,
  overflow_loss_amount NUMERIC NOT NULL DEFAULT 0,
  direct_invite_count INTEGER NOT NULL DEFAULT 0,
  team_total_count INTEGER NOT NULL DEFAULT 0,
  tree_level INTEGER NOT NULL DEFAULT 0,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_users_inviter_id ON users(inviter_id);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT,
  category VARCHAR(50),
  spec VARCHAR(200),
  main_images JSONB NOT NULL DEFAULT '[]',
  detail_images JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'on_sale',
  sort_order INTEGER NOT NULL DEFAULT 0,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 商品分类表
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 行业分类表
CREATE TABLE IF NOT EXISTS industries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 商城订单表
CREATE TABLE IF NOT EXISTS mall_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no VARCHAR(32) NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  product_image TEXT,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL,
  receive_name VARCHAR(50),
  receive_phone VARCHAR(20),
  receive_address TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  payment_screenshot_url TEXT,
  payment_confirmed_at TIMESTAMPTZ(3),
  logistics_company VARCHAR(50),
  logistics_no VARCHAR(50),
  shipped_at TIMESTAMPTZ(3),
  delivered_at TIMESTAMPTZ(3),
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ(3),
  auto_confirm_deadline TIMESTAMPTZ(3),
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_orders_order_no_key ON mall_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_mall_orders_user_id ON mall_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_mall_orders_status ON mall_orders(status);

-- 咨询订单表
CREATE TABLE IF NOT EXISTS consult_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no VARCHAR(32) NOT NULL UNIQUE,
  student_id UUID NOT NULL,
  consultant_id UUID NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  task_level_from VARCHAR(20),
  task_level_to VARCHAR(20),
  task_index INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  payment_screenshot_url TEXT,
  payment_confirmed_at TIMESTAMPTZ(3),
  work_screenshot_url TEXT,
  work_submitted_at TIMESTAMPTZ(3),
  work_reviewed_at TIMESTAMPTZ(3),
  review_remark TEXT,
  is_overflow BOOLEAN NOT NULL DEFAULT false,
  overflow_to_group BOOLEAN NOT NULL DEFAULT false,
  auto_confirm_deadline TIMESTAMPTZ(3),
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS consult_orders_order_no_key ON consult_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_consult_orders_student_id ON consult_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_consult_orders_consultant_id ON consult_orders(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consult_orders_status ON consult_orders(status);

-- 团队关系表
CREATE TABLE IF NOT EXISTS team_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  parent_id UUID,
  inviter_id UUID,
  tree_level INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS team_relations_user_id_key ON team_relations(user_id);
CREATE INDEX IF NOT EXISTS idx_team_relations_parent_id ON team_relations(parent_id);

-- 邀请记录表
CREATE TABLE IF NOT EXISTS invite_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  invite_code VARCHAR(20) NOT NULL,
  registered_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invite_records_inviter_id ON invite_records(inviter_id);

-- 升级任务表
CREATE TABLE IF NOT EXISTS upgrade_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  from_level VARCHAR(20) NOT NULL,
  to_level VARCHAR(20) NOT NULL,
  task_index INTEGER NOT NULL,
  task_type VARCHAR(30) NOT NULL,
  title VARCHAR(200) NOT NULL,
  amount NUMERIC NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  target_id UUID,
  order_id UUID,
  mall_order_id UUID,
  completed_at TIMESTAMPTZ(3),
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upgrade_tasks_user_id ON upgrade_tasks(user_id);

-- 平台收款码表
CREATE TABLE IF NOT EXISTS platform_qrcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL UNIQUE,
  wechat_qrcode_url TEXT,
  alipay_qrcode_url TEXT,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_qrcodes_type_key ON platform_qrcodes(type);

-- 插入初始数据：行业分类
INSERT INTO industries (name, sort_order) VALUES
('电商运营', 1),
('法律咨询', 2),
('心理咨询', 3),
('财务会计', 4),
('教育培训', 5),
('健康医疗', 6),
('技术开发', 7),
('设计创意', 8),
('市场营销', 9),
('其他', 99)
ON CONFLICT DO NOTHING;

-- 插入初始数据：商品分类
INSERT INTO product_categories (name, sort_order) VALUES
('数码电子', 1),
('家居生活', 2),
('美妆护肤', 3),
('服饰鞋包', 4),
('食品饮料', 5),
('其他', 99)
ON CONFLICT DO NOTHING;

-- 插入初始数据：平台收款码
INSERT INTO platform_qrcodes (type) VALUES
('mall'),
('consultant_group')
ON CONFLICT DO NOTHING;
