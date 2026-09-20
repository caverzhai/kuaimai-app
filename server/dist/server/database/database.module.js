"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = exports.DRIZZLE_DATABASE = void 0;
const common_1 = require("@nestjs/common");
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
exports.DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';
let DatabaseModule = class DatabaseModule {
    db;
    constructor(db) {
        this.db = db;
    }
    async onModuleInit() {
        try {
            await this.db.execute((0, drizzle_orm_1.sql) `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_back_url text
      `);
            console.log('[Migration] id_card_back_url 字段已确保存在');
            await this.db.execute((0, drizzle_orm_1.sql) `
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
            await this.db.execute((0, drizzle_orm_1.sql) `
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
            await this.db.execute((0, drizzle_orm_1.sql) `
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
            await this.db.execute((0, drizzle_orm_1.sql) `
        CREATE TABLE IF NOT EXISTS chat_blocked_words (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          word varchar(50) NOT NULL UNIQUE,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
            console.log('[Migration] chat_blocked_words 表已确保存在');
            await this.db.execute((0, drizzle_orm_1.sql) `
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
            await this.db.execute((0, drizzle_orm_1.sql) `
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
            await this.db.execute((0, drizzle_orm_1.sql) `
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
            await this.db.execute((0, drizzle_orm_1.sql) `
        ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS scheduled_start_time timestamptz(3)
      `);
            await this.db.execute((0, drizzle_orm_1.sql) `
        ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS scheduled_end_time timestamptz(3)
      `);
            console.log('[Migration] chat_rooms 定时字段已确保存在');
            await this.db.execute((0, drizzle_orm_1.sql) `CREATE INDEX IF NOT EXISTS idx_chat_messages_expires_at ON chat_messages(expires_at)`);
            await this.db.execute((0, drizzle_orm_1.sql) `CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id)`);
        }
        catch (err) {
            console.error('[Migration] 迁移失败', err);
        }
    }
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.DRIZZLE_DATABASE,
                useFactory: () => {
                    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
                    if (!databaseUrl) {
                        throw new Error('DATABASE_URL 环境变量未设置');
                    }
                    const client = postgres(databaseUrl, { max: 10 });
                    return (0, postgres_js_1.drizzle)(client);
                },
            },
        ],
        exports: [exports.DRIZZLE_DATABASE],
    }),
    __param(0, (0, common_1.Inject)(exports.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], DatabaseModule);
const drizzle_orm_1 = require("drizzle-orm");
//# sourceMappingURL=database.module.js.map