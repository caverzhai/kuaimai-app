"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersTable = exports.upgradeTasksTable = exports.teamRelationsTable = exports.productsTable = exports.productCategoriesTable = exports.platformQrcodesTable = exports.mallOrdersTable = exports.inviteRecordsTable = exports.industriesTable = exports.consultOrdersTable = exports.users = exports.products = exports.mallOrders = exports.consultOrders = exports.upgradeTasks = exports.teamRelations = exports.platformQrcodes = exports.inviteRecords = exports.productCategories = exports.industries = exports.fileAttachmentArray = exports.userProfileArray = exports.fileAttachment = exports.userProfile = exports.customTimestamptz = void 0;
exports.escapeLiteral = escapeLiteral;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.customTimestamptz = (0, pg_core_1.customType)({
    dataType(config) {
        const precision = typeof config?.precision !== 'undefined'
            ? ` (${config.precision})`
            : '';
        return `timestamptz${precision}`;
    },
    toDriver(value) {
        if (value == null)
            return value;
        if (typeof value === 'number')
            return new Date(value).toISOString();
        if (typeof value === 'string')
            return value;
        if (value instanceof Date)
            return value.toISOString();
        throw new Error('Invalid timestamp value');
    },
    fromDriver(value) {
        if (value instanceof Date)
            return value;
        return new Date(value);
    },
});
exports.userProfile = (0, pg_core_1.customType)({
    dataType() {
        return 'user_profile';
    },
    toDriver(value) {
        return (0, drizzle_orm_1.sql) `ROW(${value})::user_profile`;
    },
    fromDriver(value) {
        const [userId] = value.slice(1, -1).split(',');
        return userId.trim();
    },
});
exports.fileAttachment = (0, pg_core_1.customType)({
    dataType() {
        return 'file_attachment';
    },
    toDriver(value) {
        return (0, drizzle_orm_1.sql) `ROW(${value.bucket_id},${value.file_path})::file_attachment`;
    },
    fromDriver(value) {
        const [bucketId, filePath] = value.slice(1, -1).split(',');
        return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    },
});
function escapeLiteral(str) {
    return "'" + str.replace(/'/g, "''") + "'";
}
exports.userProfileArray = (0, pg_core_1.customType)({
    dataType() {
        return 'user_profile[]';
    },
    toDriver(value) {
        if (!value || value.length === 0) {
            return (0, drizzle_orm_1.sql) `'{}'::user_profile[]`;
        }
        const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
        return drizzle_orm_1.sql.raw(`ARRAY[${elements}]::user_profile[]`);
    },
    fromDriver(value) {
        if (!value || value === '{}')
            return [];
        const inner = value.slice(1, -1);
        const matches = inner.match(/\([^)]*\)/g) || [];
        return matches.map(m => m.slice(1, -1).split(',')[0].trim());
    },
});
exports.fileAttachmentArray = (0, pg_core_1.customType)({
    dataType() {
        return 'file_attachment[]';
    },
    toDriver(value) {
        if (!value || value.length === 0) {
            return (0, drizzle_orm_1.sql) `'{}'::file_attachment[]`;
        }
        const elements = value.map(f => `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`).join(',');
        return drizzle_orm_1.sql.raw(`ARRAY[${elements}]::file_attachment[]`);
    },
    fromDriver(value) {
        if (!value || value === '{}')
            return [];
        const inner = value.slice(1, -1);
        const matches = inner.match(/\([^)]*\)/g) || [];
        return matches.map(m => {
            const [bucketId, filePath] = m.slice(1, -1).split(',');
            return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
        });
    },
});
exports.industries = (0, pg_core_1.pgTable)("industries", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)("name", { length: 50 }).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").notNull().default(0),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
});
exports.productCategories = (0, pg_core_1.pgTable)("product_categories", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)("name", { length: 50 }).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").notNull().default(0),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
});
exports.inviteRecords = (0, pg_core_1.pgTable)("invite_records", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    inviterId: (0, pg_core_1.uuid)("inviter_id").notNull(),
    inviteeId: (0, pg_core_1.uuid)("invitee_id").notNull(),
    inviteCode: (0, pg_core_1.varchar)("invite_code", { length: 20 }).notNull(),
    registeredAt: (0, exports.customTimestamptz)("registered_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.index)("idx_invite_records_inviter_id").on(table.inviterId),
]);
exports.platformQrcodes = (0, pg_core_1.pgTable)("platform_qrcodes", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    type: (0, pg_core_1.varchar)("type", { length: 20 }).notNull().unique(),
    wechatQrcodeUrl: (0, pg_core_1.text)("wechat_qrcode_url"),
    alipayQrcodeUrl: (0, pg_core_1.text)("alipay_qrcode_url"),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.uniqueIndex)("platform_qrcodes_type_key").on(table.type),
]);
exports.teamRelations = (0, pg_core_1.pgTable)("team_relations", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)("user_id").notNull().unique(),
    parentId: (0, pg_core_1.uuid)("parent_id"),
    inviterId: (0, pg_core_1.uuid)("inviter_id"),
    treeLevel: (0, pg_core_1.integer)("tree_level").notNull().default(0),
    path: (0, pg_core_1.text)("path").notNull(),
    position: (0, pg_core_1.integer)("position").notNull().default(0),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.uniqueIndex)("team_relations_user_id_key").on(table.userId),
    (0, pg_core_1.index)("idx_team_relations_parent_id").on(table.parentId),
]);
exports.upgradeTasks = (0, pg_core_1.pgTable)("upgrade_tasks", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)("user_id").notNull(),
    fromLevel: (0, pg_core_1.varchar)("from_level", { length: 20 }).notNull(),
    toLevel: (0, pg_core_1.varchar)("to_level", { length: 20 }).notNull(),
    taskIndex: (0, pg_core_1.integer)("task_index").notNull(),
    taskType: (0, pg_core_1.varchar)("task_type", { length: 30 }).notNull(),
    title: (0, pg_core_1.varchar)("title", { length: 200 }).notNull(),
    amount: (0, pg_core_1.numeric)("amount").notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default('pending'),
    targetId: (0, pg_core_1.uuid)("target_id"),
    orderId: (0, pg_core_1.uuid)("order_id"),
    mallOrderId: (0, pg_core_1.uuid)("mall_order_id"),
    completedAt: (0, exports.customTimestamptz)("completed_at", { precision: 3 }),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.index)("idx_upgrade_tasks_user_id").on(table.userId),
]);
exports.consultOrders = (0, pg_core_1.pgTable)("consult_orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    orderNo: (0, pg_core_1.varchar)("order_no", { length: 32 }).notNull().unique(),
    studentId: (0, pg_core_1.uuid)("student_id").notNull(),
    consultantId: (0, pg_core_1.uuid)("consultant_id").notNull(),
    serviceType: (0, pg_core_1.varchar)("service_type", { length: 50 }).notNull(),
    amount: (0, pg_core_1.numeric)("amount").notNull(),
    taskLevelFrom: (0, pg_core_1.varchar)("task_level_from", { length: 20 }),
    taskLevelTo: (0, pg_core_1.varchar)("task_level_to", { length: 20 }),
    taskIndex: (0, pg_core_1.integer)("task_index"),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default('pending_payment'),
    paymentScreenshotUrl: (0, pg_core_1.text)("payment_screenshot_url"),
    paymentConfirmedAt: (0, exports.customTimestamptz)("payment_confirmed_at", { precision: 3 }),
    workScreenshotUrl: (0, pg_core_1.text)("work_screenshot_url"),
    workSubmittedAt: (0, exports.customTimestamptz)("work_submitted_at", { precision: 3 }),
    workReviewedAt: (0, exports.customTimestamptz)("work_reviewed_at", { precision: 3 }),
    reviewRemark: (0, pg_core_1.text)("review_remark"),
    isOverflow: (0, pg_core_1.boolean)("is_overflow").notNull().default(false),
    overflowToGroup: (0, pg_core_1.boolean)("overflow_to_group").notNull().default(false),
    autoConfirmDeadline: (0, exports.customTimestamptz)("auto_confirm_deadline", { precision: 3 }),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.uniqueIndex)("consult_orders_order_no_key").on(table.orderNo),
    (0, pg_core_1.index)("idx_consult_orders_student_id").on(table.studentId),
    (0, pg_core_1.index)("idx_consult_orders_consultant_id").on(table.consultantId),
    (0, pg_core_1.index)("idx_consult_orders_status").on(table.status),
]);
exports.mallOrders = (0, pg_core_1.pgTable)("mall_orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    orderNo: (0, pg_core_1.varchar)("order_no", { length: 32 }).notNull().unique(),
    userId: (0, pg_core_1.uuid)("user_id").notNull(),
    productId: (0, pg_core_1.uuid)("product_id").notNull(),
    productName: (0, pg_core_1.varchar)("product_name", { length: 200 }).notNull(),
    productImage: (0, pg_core_1.text)("product_image"),
    price: (0, pg_core_1.numeric)("price").notNull(),
    quantity: (0, pg_core_1.integer)("quantity").notNull().default(1),
    totalAmount: (0, pg_core_1.numeric)("total_amount").notNull(),
    receiveName: (0, pg_core_1.varchar)("receive_name", { length: 50 }),
    receivePhone: (0, pg_core_1.varchar)("receive_phone", { length: 20 }),
    receiveAddress: (0, pg_core_1.text)("receive_address"),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default('pending_payment'),
    paymentScreenshotUrl: (0, pg_core_1.text)("payment_screenshot_url"),
    paymentConfirmedAt: (0, exports.customTimestamptz)("payment_confirmed_at", { precision: 3 }),
    logisticsCompany: (0, pg_core_1.varchar)("logistics_company", { length: 50 }),
    logisticsNo: (0, pg_core_1.varchar)("logistics_no", { length: 50 }),
    shippedAt: (0, exports.customTimestamptz)("shipped_at", { precision: 3 }),
    deliveredAt: (0, exports.customTimestamptz)("delivered_at", { precision: 3 }),
    cancelReason: (0, pg_core_1.text)("cancel_reason"),
    cancelledAt: (0, exports.customTimestamptz)("cancelled_at", { precision: 3 }),
    autoConfirmDeadline: (0, exports.customTimestamptz)("auto_confirm_deadline", { precision: 3 }),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.uniqueIndex)("mall_orders_order_no_key").on(table.orderNo),
    (0, pg_core_1.index)("idx_mall_orders_user_id").on(table.userId),
    (0, pg_core_1.index)("idx_mall_orders_status").on(table.status),
]);
exports.products = (0, pg_core_1.pgTable)("products", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)("name", { length: 200 }).notNull(),
    price: (0, pg_core_1.numeric)("price").notNull(),
    description: (0, pg_core_1.text)("description"),
    category: (0, pg_core_1.varchar)("category", { length: 50 }),
    spec: (0, pg_core_1.varchar)("spec", { length: 200 }),
    mainImages: (0, pg_core_1.jsonb)("main_images").notNull().default('[]'),
    detailImages: (0, pg_core_1.jsonb)("detail_images").notNull().default('[]'),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).notNull().default('on_sale'),
    sortOrder: (0, pg_core_1.integer)("sort_order").notNull().default(0),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.index)("idx_products_status").on(table.status),
    (0, pg_core_1.index)("idx_products_category").on(table.category),
]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    phone: (0, pg_core_1.varchar)("phone", { length: 20 }).notNull().unique(),
    nickname: (0, pg_core_1.varchar)("nickname", { length: 50 }).notNull(),
    password: (0, pg_core_1.varchar)("password", { length: 255 }).notNull(),
    avatarUrl: (0, pg_core_1.text)("avatar_url"),
    gender: (0, pg_core_1.varchar)("gender", { length: 10 }),
    age: (0, pg_core_1.integer)("age"),
    level: (0, pg_core_1.varchar)("level", { length: 20 }).notNull().default('junior'),
    isInvited: (0, pg_core_1.boolean)("is_invited").notNull().default(false),
    inviterId: (0, pg_core_1.uuid)("inviter_id"),
    parentId: (0, pg_core_1.uuid)("parent_id"),
    inviteCode: (0, pg_core_1.varchar)("invite_code", { length: 20 }).unique(),
    receiveAddress: (0, pg_core_1.text)("receive_address"),
    receivePhone: (0, pg_core_1.varchar)("receive_phone", { length: 20 }),
    industry: (0, pg_core_1.varchar)("industry", { length: 100 }),
    consultantLevel: (0, pg_core_1.varchar)("consultant_level", { length: 20 }).default('middle'),
    qualification: (0, pg_core_1.text)("qualification"),
    serviceStandard: (0, pg_core_1.text)("service_standard"),
    serviceIntroduction: (0, pg_core_1.varchar)("service_introduction", { length: 500 }),
    realName: (0, pg_core_1.varchar)("real_name", { length: 50 }),
    wechatId: (0, pg_core_1.varchar)("wechat_id", { length: 100 }),
    idCardFrontUrl: (0, pg_core_1.text)("id_card_front_url"),
    wechatQrcodeUrl: (0, pg_core_1.text)("wechat_qrcode_url"),
    alipayQrcodeUrl: (0, pg_core_1.text)("alipay_qrcode_url"),
    companyQrcodeUrl: (0, pg_core_1.text)("company_qrcode_url"),
    businessLicenseUrl: (0, pg_core_1.text)("business_license_url"),
    companyAuditStatus: (0, pg_core_1.varchar)("company_audit_status", { length: 20 }).default('none'),
    totalConsultIncome: (0, pg_core_1.numeric)("total_consult_income").notNull().default('0'),
    thresholdBlocked: (0, pg_core_1.boolean)("threshold_blocked").notNull().default(false),
    thresholdTriggeredAt: (0, exports.customTimestamptz)("threshold_triggered_at", { precision: 3 }),
    pendingReclaimAmount: (0, pg_core_1.numeric)("pending_reclaim_amount").notNull().default('0'),
    overflowLossAmount: (0, pg_core_1.numeric)("overflow_loss_amount").notNull().default('0'),
    directInviteCount: (0, pg_core_1.integer)("direct_invite_count").notNull().default(0),
    teamTotalCount: (0, pg_core_1.integer)("team_total_count").notNull().default(0),
    treeLevel: (0, pg_core_1.integer)("tree_level").notNull().default(0),
    createdAt: (0, exports.customTimestamptz)("_created_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, exports.customTimestamptz)("_updated_at", { precision: 3 }).notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
}, (table) => [
    (0, pg_core_1.uniqueIndex)("users_phone_key").on(table.phone),
    (0, pg_core_1.uniqueIndex)("users_invite_code_key").on(table.inviteCode),
    (0, pg_core_1.index)("idx_users_phone").on(table.phone),
    (0, pg_core_1.index)("idx_users_level").on(table.level),
    (0, pg_core_1.index)("idx_users_inviter_id").on(table.inviterId),
    (0, pg_core_1.index)("idx_users_parent_id").on(table.parentId),
    (0, pg_core_1.index)("idx_users_invite_code").on(table.inviteCode),
]);
exports.consultOrdersTable = exports.consultOrders;
exports.industriesTable = exports.industries;
exports.inviteRecordsTable = exports.inviteRecords;
exports.mallOrdersTable = exports.mallOrders;
exports.platformQrcodesTable = exports.platformQrcodes;
exports.productCategoriesTable = exports.productCategories;
exports.productsTable = exports.products;
exports.teamRelationsTable = exports.teamRelations;
exports.upgradeTasksTable = exports.upgradeTasks;
exports.usersTable = exports.users;
//# sourceMappingURL=schema.js.map