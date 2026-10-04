import { Module, Global, OnModuleInit, Inject } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
        if (!databaseUrl) {
          throw new Error('DATABASE_URL 环境变量未设置');
        }
        const client = postgres(databaseUrl, { max: 10 });
        return drizzle(client);
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule implements OnModuleInit {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: any) {}

  async onModuleInit() {
    // 自动迁移：添加缺失的字段和表
    try {
      // 检查并添加 id_card_back_url 字段
      await this.db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_back_url text
      `);
      console.log('[Migration] id_card_back_url 字段已确保存在');

      // 创建聊天室相关表
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_rooms (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name varchar(100) NOT NULL,
          description text,
          type varchar(20) NOT NULL DEFAULT 'public',
          created_by uuid NOT NULL,
          max_mic_count integer NOT NULL DEFAULT 3,
          is_active boolean NOT NULL DEFAULT true,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[Migration] chat_rooms 表已确保存在');

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_room_members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL,
          user_id uuid NOT NULL,
          role varchar(20) NOT NULL DEFAULT 'member',
          is_muted boolean NOT NULL DEFAULT false,
          is_blocked boolean NOT NULL DEFAULT false,
          joined_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(room_id, user_id)
        )
      `);
      console.log('[Migration] chat_room_members 表已确保存在');

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL,
          user_id uuid NOT NULL,
          type varchar(20) NOT NULL DEFAULT 'text',
          content text,
          duration integer,
          expires_at timestamptz(3) NOT NULL,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[Migration] chat_messages 表已确保存在');

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_blocked_words (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          word varchar(50) NOT NULL UNIQUE,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[Migration] chat_blocked_words 表已确保存在');

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_mic_slots (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL,
          user_id uuid NOT NULL,
          slot_index integer NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(room_id, slot_index)
        )
      `);
      console.log('[Migration] chat_mic_slots 表已确保存在');

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS friends (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL,
          friend_id uuid NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'pending',
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, friend_id)
        )
      `);
      console.log('[Migration] friends 表已确保存在');

      // 创建聊天室申请表
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_room_applications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL,
          room_name varchar(50) NOT NULL,
          description varchar(200) NOT NULL,
          usage_time varchar(100) NOT NULL,
          contact_phone varchar(20) NOT NULL,
          scheduled_start_time timestamptz(3),
          scheduled_end_time timestamptz(3),
          status varchar(20) NOT NULL DEFAULT 'pending',
          approved_by uuid,
          room_id uuid,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[Migration] chat_room_applications 表已确保存在');

      // 为chat_rooms添加定时上线字段
      await this.db.execute(sql`
        ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS scheduled_start_time timestamptz(3)
      `);
      await this.db.execute(sql`
        ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS scheduled_end_time timestamptz(3)
      `);
      console.log('[Migration] chat_rooms 定时字段已确保存在');

      // 创建索引
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_expires_at ON chat_messages(expires_at)`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id)`);

      // 商家相关字段迁移
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller boolean NOT NULL DEFAULT false`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_status varchar(20) DEFAULT 'none'`)
      await this.db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id uuid`)
      await this.db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_name varchar(100)`)
      await this.db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_wechat_qrcode_url text`)
      await this.db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_alipay_qrcode_url text`)
      await this.db.execute(sql`ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS seller_id uuid`)
      await this.db.execute(sql`ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS seller_name varchar(100)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_mall_orders_seller_id ON mall_orders(seller_id)`)

      // 安全问题字段迁移
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question varchar(200)`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer varchar(200)`)
      console.log('[Migration] 安全问题字段已确保存在')

      // 创建管理费表
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS management_fees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id uuid NOT NULL,
          seller_name varchar(100),
          fee_date timestamptz(3) NOT NULL,
          total_sales numeric NOT NULL DEFAULT 0,
          fee_amount numeric NOT NULL DEFAULT 0,
          status varchar(20) NOT NULL DEFAULT 'pending',
          payment_screenshot_url text,
          paid_at timestamptz(3),
          confirmed_by uuid,
          confirmed_at timestamptz(3),
          deadline timestamptz(3),
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_management_fees_seller_id ON management_fees(seller_id)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_management_fees_status ON management_fees(status)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_management_fees_fee_date ON management_fees(fee_date)`)
      await this.db.execute(sql`ALTER TABLE management_fees ADD COLUMN IF NOT EXISTS warehoused_product_ids text`)
      console.log('[Migration] 商家相关字段和管理费表已确保存在')

      // ── 四星60天考核机制字段 ──
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS assessment_status varchar(20) NOT NULL DEFAULT 'none'`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS four_star_at timestamptz(3)`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_collected_amount numeric NOT NULL DEFAULT '0'`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS refund_rate integer`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT '0'`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS refund_status varchar(20) NOT NULL DEFAULT 'none'`)
      // ── 分身号机制字段 ──
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_clone boolean NOT NULL DEFAULT false`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clone_of_id uuid`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS replacement_for_id uuid`)
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clone_eligible boolean NOT NULL DEFAULT false`)
      console.log('[Migration] 四星考核与分身号字段已确保存在')

      // 平台代收明细表
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS platform_collection_records (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          consultant_id uuid NOT NULL,
          consult_order_id uuid NOT NULL,
          amount numeric NOT NULL,
          refund_status varchar(20) NOT NULL DEFAULT 'pending',
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_collection_consultant ON platform_collection_records(consultant_id)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_collection_order ON platform_collection_records(consult_order_id)`)
      // 流失费相关列（级别不够永久流失 + 代收明细类型）
      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_loss_amount numeric NOT NULL DEFAULT '0'`)
      await this.db.execute(sql`ALTER TABLE consult_orders ADD COLUMN IF NOT EXISTS is_level_shortfall boolean NOT NULL DEFAULT false`)
      await this.db.execute(sql`ALTER TABLE consult_orders ADD COLUMN IF NOT EXISTS original_consultant_id uuid`)
      await this.db.execute(sql`ALTER TABLE platform_collection_records ADD COLUMN IF NOT EXISTS loss_type varchar(20) NOT NULL DEFAULT 'assessment'`)
      console.log('[Migration] 流失费字段已确保存在')

      // 分身资格通知表
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS clone_notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          eligible_user_id uuid NOT NULL,
          eliminated_user_id uuid NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'pending_phone',
          clone_user_id uuid,
          new_phone varchar(20),
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clone_notifications_eligible ON clone_notifications(eligible_user_id)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clone_notifications_eliminated ON clone_notifications(eliminated_user_id)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clone_notifications_status ON clone_notifications(status)`)
      console.log('[Migration] 代收明细表与分身通知表已确保存在')

      // 系统通知表（管理员全员广播/个人通知，客户端按 seq 增量轮询拉取）
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS system_notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          seq integer GENERATED ALWAYS AS IDENTITY,
          user_id uuid,
          title varchar(100) NOT NULL,
          body text NOT NULL,
          type varchar(20) NOT NULL DEFAULT 'system',
          payload jsonb,
          created_by uuid,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await this.db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_system_notifications_seq ON system_notifications(seq)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_system_notifications_user ON system_notifications(user_id)`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_system_notifications_created ON system_notifications(_created_at)`)
      // 送达确认：collect 收款通知是否已成功下发给目标用户（至少送达一次，避免错过窗口丢失）
      await this.db.execute(sql`ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS acked boolean NOT NULL DEFAULT false`)
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_system_notifications_pending_ack ON system_notifications(user_id, acked)`)
      console.log('[Migration] 系统通知表已确保存在')

      // 平台公告表（互动中心通知栏，单条）
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS platform_notices (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          content text NOT NULL DEFAULT '',
          updated_by uuid,
          _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await this.db.execute(sql`INSERT INTO platform_notices (content) SELECT '' WHERE NOT EXISTS (SELECT 1 FROM platform_notices)`)
      console.log('[Migration] 平台公告表已确保存在')

      // 商品推广费率（每个商品可单独设置，默认8%）
      await this.db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion_fee_rate numeric NOT NULL DEFAULT '0.08'`)
      console.log('[Migration] 商品推广费率字段已确保存在')

    } catch (err) {
      console.error('[Migration] 迁移失败', err);
    }
  }
}

// 导入sql用于迁移
import { sql } from 'drizzle-orm';
