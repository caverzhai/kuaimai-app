// @ts-nocheck
/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const industries = pgTable("industries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productCategories = pgTable("product_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const inviteRecords = pgTable("invite_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  inviterId: uuid("inviter_id").notNull(),
  inviteeId: uuid("invitee_id").notNull(),
  inviteCode: varchar("invite_code", { length: 20 }).notNull(),
  registeredAt: customTimestamptz("registered_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_invite_records_inviter_id").on(table.inviterId),
]);

export const platformQrcodes = pgTable("platform_qrcodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull().unique(),
  wechatQrcodeUrl: text("wechat_qrcode_url"),
  alipayQrcodeUrl: text("alipay_qrcode_url"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("platform_qrcodes_type_key").on(table.type),
]);

export const teamRelations = pgTable("team_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  parentId: uuid("parent_id"),
  inviterId: uuid("inviter_id"),
  treeLevel: integer("tree_level").notNull().default(0),
  path: text("path").notNull(),
  position: integer("position").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("team_relations_user_id_key").on(table.userId),
  index("idx_team_relations_parent_id").on(table.parentId),
]);

export const upgradeTasks = pgTable("upgrade_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  fromLevel: varchar("from_level", { length: 20 }).notNull(),
  toLevel: varchar("to_level", { length: 20 }).notNull(),
  taskIndex: integer("task_index").notNull(),
  taskType: varchar("task_type", { length: 30 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  amount: numeric("amount").notNull(),
  status: varchar("status", { length: 30 }).notNull().default('pending'),
  targetId: uuid("target_id"),
  orderId: uuid("order_id"),
  mallOrderId: uuid("mall_order_id"),
  completedAt: customTimestamptz("completed_at", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_upgrade_tasks_user_id").on(table.userId),
]);

export const consultOrders = pgTable("consult_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNo: varchar("order_no", { length: 32 }).notNull().unique(),
  studentId: uuid("student_id").notNull(),
  consultantId: uuid("consultant_id").notNull(),
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  amount: numeric("amount").notNull(),
  taskLevelFrom: varchar("task_level_from", { length: 20 }),
  taskLevelTo: varchar("task_level_to", { length: 20 }),
  taskIndex: integer("task_index"),
  status: varchar("status", { length: 30 }).notNull().default('pending_payment'),
  paymentScreenshotUrl: text("payment_screenshot_url"),
  paymentConfirmedAt: customTimestamptz("payment_confirmed_at", { precision: 3 }),
  workScreenshotUrl: text("work_screenshot_url"),
  workSubmittedAt: customTimestamptz("work_submitted_at", { precision: 3 }),
  workReviewedAt: customTimestamptz("work_reviewed_at", { precision: 3 }),
  reviewRemark: text("review_remark"),
  isOverflow: boolean("is_overflow").notNull().default(false),
  overflowToGroup: boolean("overflow_to_group").notNull().default(false),
  autoConfirmDeadline: customTimestamptz("auto_confirm_deadline", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("consult_orders_order_no_key").on(table.orderNo),
  index("idx_consult_orders_student_id").on(table.studentId),
  index("idx_consult_orders_consultant_id").on(table.consultantId),
  index("idx_consult_orders_status").on(table.status),
]);

export const mallOrders = pgTable("mall_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNo: varchar("order_no", { length: 32 }).notNull().unique(),
  userId: uuid("user_id").notNull(),
  productId: uuid("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  productImage: text("product_image"),
  price: numeric("price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  totalAmount: numeric("total_amount").notNull(),
  receiveName: varchar("receive_name", { length: 50 }),
  receivePhone: varchar("receive_phone", { length: 20 }),
  receiveAddress: text("receive_address"),
  status: varchar("status", { length: 30 }).notNull().default('pending_payment'),
  paymentScreenshotUrl: text("payment_screenshot_url"),
  paymentConfirmedAt: customTimestamptz("payment_confirmed_at", { precision: 3 }),
  logisticsCompany: varchar("logistics_company", { length: 50 }),
  logisticsNo: varchar("logistics_no", { length: 50 }),
  shippedAt: customTimestamptz("shipped_at", { precision: 3 }),
  deliveredAt: customTimestamptz("delivered_at", { precision: 3 }),
  cancelReason: text("cancel_reason"),
  cancelledAt: customTimestamptz("cancelled_at", { precision: 3 }),
  autoConfirmDeadline: customTimestamptz("auto_confirm_deadline", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("mall_orders_order_no_key").on(table.orderNo),
  index("idx_mall_orders_user_id").on(table.userId),
  index("idx_mall_orders_status").on(table.status),
]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  price: numeric("price").notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  spec: varchar("spec", { length: 200 }),
  /**
   * @type { url: string }[]
   */
  mainImages: jsonb("main_images").notNull().default('[]'),
  /**
   * @type { url: string }[]
   */
  detailImages: jsonb("detail_images").notNull().default('[]'),
  status: varchar("status", { length: 20 }).notNull().default('on_sale'),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_products_status").on(table.status),
  index("idx_products_category").on(table.category),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  nickname: varchar("nickname", { length: 50 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  gender: varchar("gender", { length: 10 }),
  age: integer("age"),
  level: varchar("level", { length: 20 }).notNull().default('junior'),
  isInvited: boolean("is_invited").notNull().default(false),
  inviterId: uuid("inviter_id"),
  parentId: uuid("parent_id"),
  inviteCode: varchar("invite_code", { length: 20 }).unique(),
  receiveAddress: text("receive_address"),
  receivePhone: varchar("receive_phone", { length: 20 }),
  industry: varchar("industry", { length: 100 }),
  consultantLevel: varchar("consultant_level", { length: 20 }).default('middle'),
  qualification: text("qualification"),
  serviceStandard: text("service_standard"),
  serviceIntroduction: varchar("service_introduction", { length: 500 }),
  realName: varchar("real_name", { length: 50 }),
  wechatId: varchar("wechat_id", { length: 100 }),
  idCardFrontUrl: text("id_card_front_url"),
  idCardBackUrl: text("id_card_back_url"),
  wechatQrcodeUrl: text("wechat_qrcode_url"),
  alipayQrcodeUrl: text("alipay_qrcode_url"),
  companyQrcodeUrl: text("company_qrcode_url"),
  businessLicenseUrl: text("business_license_url"),
  companyAuditStatus: varchar("company_audit_status", { length: 20 }).default('none'),
  totalConsultIncome: numeric("total_consult_income").notNull().default('0'),
  thresholdBlocked: boolean("threshold_blocked").notNull().default(false),
  thresholdTriggeredAt: customTimestamptz("threshold_triggered_at", { precision: 3 }),
  pendingReclaimAmount: numeric("pending_reclaim_amount").notNull().default('0'),
  overflowLossAmount: numeric("overflow_loss_amount").notNull().default('0'),
  directInviteCount: integer("direct_invite_count").notNull().default(0),
  teamTotalCount: integer("team_total_count").notNull().default(0),
  treeLevel: integer("tree_level").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("users_phone_key").on(table.phone),
  uniqueIndex("users_invite_code_key").on(table.inviteCode),
  index("idx_users_phone").on(table.phone),
  index("idx_users_level").on(table.level),
  index("idx_users_inviter_id").on(table.inviterId),
  index("idx_users_parent_id").on(table.parentId),
  index("idx_users_invite_code").on(table.inviteCode),
]);

// table aliases
export const consultOrdersTable = consultOrders;
export const industriesTable = industries;
export const inviteRecordsTable = inviteRecords;
export const mallOrdersTable = mallOrders;
export const platformQrcodesTable = platformQrcodes;
export const productCategoriesTable = productCategories;
export const productsTable = products;
export const teamRelationsTable = teamRelations;
export const upgradeTasksTable = upgradeTasks;
export const usersTable = users;

// ============================================================
// 聊天室相关表
// ============================================================

// 聊天室
export const chatRooms = pgTable("chat_rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default('public'), // public=管理员创建(有麦位), personal=个人创建(无麦位)
  createdBy: uuid("created_by").notNull(),
  maxMicCount: integer("max_mic_count").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  scheduledStartTime: customTimestamptz("scheduled_start_time", { precision: 3 }), // 定时上线时间
  scheduledEndTime: customTimestamptz("scheduled_end_time", { precision: 3 }), // 定时下线时间
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_chat_rooms_type").on(table.type),
  index("idx_chat_rooms_is_active").on(table.isActive),
]);

// 聊天室成员
export const chatRoomMembers = pgTable("chat_room_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull().default('member'), // owner, host, member
  isMuted: boolean("is_muted").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  joinedAt: customTimestamptz("joined_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("chat_room_members_room_user_key").on(table.roomId, table.userId),
  index("idx_chat_room_members_room_id").on(table.roomId),
  index("idx_chat_room_members_user_id").on(table.userId),
]);

// 聊天室申请
export const chatRoomApplications = pgTable("chat_room_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  roomName: varchar("room_name", { length: 50 }).notNull(), // 聊天室名称（12个汉字以内）
  description: varchar("description", { length: 200 }).notNull(), // 50字说明
  usageTime: varchar("usage_time", { length: 100 }).notNull(), // 使用时间段
  contactPhone: varchar("contact_phone", { length: 20 }).notNull(), // 联系电话
  scheduledStartTime: customTimestamptz("scheduled_start_time", { precision: 3 }), // 定时上线时间
  scheduledEndTime: customTimestamptz("scheduled_end_time", { precision: 3 }), // 定时下线时间
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, approved, rejected, expired
  approvedBy: uuid("approved_by"),
  roomId: uuid("room_id"), // 审批通过后创建的聊天室ID
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_chat_room_applications_user_id").on(table.userId),
  index("idx_chat_room_applications_status").on(table.status),
  index("idx_chat_room_applications_created_at").on(table.createdAt),
]);

// 聊天消息（只保存30分钟）
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull(),
  userId: uuid("user_id").notNull(),
  type: varchar("type", { length: 20 }).notNull().default('text'), // text, image, audio, system
  content: text("content"),
  duration: integer("duration"), // 语音时长（秒）
  expiresAt: customTimestamptz("expires_at", { precision: 3 }).notNull(),
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_chat_messages_room_id").on(table.roomId),
  index("idx_chat_messages_expires_at").on(table.expiresAt),
  index("idx_chat_messages_created_at").on(table.createdAt),
]);

// 屏蔽词
export const chatBlockedWords = pgTable("chat_blocked_words", {
  id: uuid("id").defaultRandom().primaryKey(),
  word: varchar("word", { length: 50 }).notNull(),
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("chat_blocked_words_word_key").on(table.word),
]);

// 麦位
export const chatMicSlots = pgTable("chat_mic_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull(),
  userId: uuid("user_id").notNull(),
  slotIndex: integer("slot_index").notNull(), // 0, 1, 2
  isActive: boolean("is_active").notNull().default(true),
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("chat_mic_slots_room_slot_key").on(table.roomId, table.slotIndex),
  index("idx_chat_mic_slots_room_id").on(table.roomId),
  index("idx_chat_mic_slots_user_id").on(table.userId),
]);

// 上麦申请
export const chatMicRequests = pgTable("chat_mic_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull(),
  userId: uuid("user_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, approved, rejected
  approvedBy: uuid("approved_by"),
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_chat_mic_requests_room_id").on(table.roomId),
  index("idx_chat_mic_requests_user_id").on(table.userId),
  index("idx_chat_mic_requests_status").on(table.status),
]);

// 好友
export const friends = pgTable("friends", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  friendId: uuid("friend_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, accepted, rejected
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("friends_user_friend_key").on(table.userId, table.friendId),
  index("idx_friends_user_id").on(table.userId),
  index("idx_friends_friend_id").on(table.friendId),
]);
