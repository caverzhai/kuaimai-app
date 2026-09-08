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

    } catch (err) {
      console.error('[Migration] 迁移失败', err);
    }
  }
}

// 导入sql用于迁移
import { sql } from 'drizzle-orm';
