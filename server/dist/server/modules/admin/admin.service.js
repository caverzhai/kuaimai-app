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
var AdminService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
const products_service_1 = require("@server/modules/products/products.service");
const upgrade_service_1 = require("@server/modules/upgrade/upgrade.service");
const api_interface_1 = require("@shared/api.interface");
let AdminService = AdminService_1 = class AdminService {
    db;
    productsService;
    upgradeService;
    logger = new common_1.Logger(AdminService_1.name);
    constructor(db, productsService, upgradeService) {
        this.db = db;
        this.productsService = productsService;
        this.upgradeService = upgradeService;
    }
    async getProductList(params) {
        return this.productsService.getAdminProductList(params);
    }
    async createProduct(dto) {
        return this.productsService.createProduct(dto);
    }
    async updateProduct(id, dto) {
        return this.productsService.updateProduct(id, dto);
    }
    async toggleProductStatus(id) {
        const detail = await this.productsService.getProductDetail(id);
        const nextStatus = detail.status === 'on_sale' ? 'off_shelf' : 'on_sale';
        return this.productsService.updateProductStatus(id, nextStatus);
    }
    toMallOrderInfo(order) {
        return {
            id: order.id,
            orderNo: order.orderNo,
            userId: order.userId,
            productId: order.productId,
            productName: order.productName,
            productImage: order.productImage ?? undefined,
            price: String(order.price),
            quantity: order.quantity,
            totalAmount: String(order.totalAmount),
            receiveName: order.receiveName ?? undefined,
            receivePhone: order.receivePhone ?? undefined,
            receiveAddress: order.receiveAddress ?? undefined,
            status: order.status,
            paymentScreenshotUrl: order.paymentScreenshotUrl ?? undefined,
            paymentConfirmedAt: order.paymentConfirmedAt
                ? order.paymentConfirmedAt.toISOString()
                : undefined,
            logisticsCompany: order.logisticsCompany ?? undefined,
            logisticsNo: order.logisticsNo ?? undefined,
            shippedAt: order.shippedAt ? order.shippedAt.toISOString() : undefined,
            deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : undefined,
            cancelReason: order.cancelReason ?? undefined,
            cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : undefined,
            autoConfirmDeadline: order.autoConfirmDeadline
                ? order.autoConfirmDeadline.toISOString()
                : undefined,
            createdAt: order.createdAt.toISOString(),
        };
    }
    async getMallOrderList(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const offset = (page - 1) * pageSize;
        const conditions = [];
        if (params.status)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.mallOrders.status, params.status));
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.mallOrders).where(whereClause),
            this.db
                .select()
                .from(schema_1.mallOrders)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.mallOrders.createdAt))
                .limit(pageSize)
                .offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            items: itemsRaw.map((item) => this.toMallOrderInfo(item)),
            total,
            page,
            pageSize,
        };
    }
    async reviewMallOrderPayment(id, dto) {
        const orderRows = await this.db.select().from(schema_1.mallOrders).where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id)).limit(1);
        const order = orderRows[0];
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== api_interface_1.MALL_ORDER_STATUS.PENDING_REVIEW) {
            throw new common_1.BadRequestException('当前订单状态不允许审核');
        }
        if (!dto.passed) {
            const updated = await this.db
                .update(schema_1.mallOrders)
                .set({
                status: api_interface_1.MALL_ORDER_STATUS.PENDING_PAYMENT,
                paymentScreenshotUrl: null,
                autoConfirmDeadline: null,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id))
                .returning();
            this.logger.log(`商城订单审核不通过: orderId=${id}`);
            return this.toMallOrderInfo(updated[0]);
        }
        const now = new Date();
        const updated = await this.db
            .update(schema_1.mallOrders)
            .set({
            status: api_interface_1.MALL_ORDER_STATUS.PENDING_SHIPMENT,
            paymentConfirmedAt: now,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id))
            .returning();
        this.logger.log(`商城订单审核通过: orderId=${id}`);
        try {
            await this.upgradeService.checkMallTaskComplete(order.userId, id, order.totalAmount);
            this.logger.log(`已检查并完成商城购买升级任务: userId=${order.userId}, orderId=${id}`);
        }
        catch (taskError) {
            this.logger.error(`完成商城购买升级任务失败: ${taskError.message}`);
        }
        return this.toMallOrderInfo(updated[0]);
    }
    async shipMallOrder(id, dto) {
        const orderRows = await this.db.select().from(schema_1.mallOrders).where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id)).limit(1);
        const order = orderRows[0];
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== api_interface_1.MALL_ORDER_STATUS.PENDING_SHIPMENT) {
            throw new common_1.BadRequestException('当前订单状态不允许发货');
        }
        const isNoLogistics = dto.logisticsCompany === '无需物流';
        if (!isNoLogistics) {
            if (!dto.logisticsCompany || !dto.logisticsNo) {
                throw new common_1.BadRequestException('物流公司和物流单号不能为空');
            }
        }
        const now = new Date();
        const updated = await this.db
            .update(schema_1.mallOrders)
            .set({
            status: api_interface_1.MALL_ORDER_STATUS.PENDING_DELIVERY,
            logisticsCompany: dto.logisticsCompany,
            logisticsNo: isNoLogistics ? null : dto.logisticsNo,
            shippedAt: now,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id))
            .returning();
        this.logger.log(`商城订单发货: orderId=${id}, 无需物流=${isNoLogistics}`);
        return this.toMallOrderInfo(updated[0]);
    }
    async cancelMallOrder(id) {
        const orderRows = await this.db.select().from(schema_1.mallOrders).where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id)).limit(1);
        const order = orderRows[0];
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status === api_interface_1.MALL_ORDER_STATUS.COMPLETED ||
            order.status === api_interface_1.MALL_ORDER_STATUS.CANCELLED) {
            throw new common_1.BadRequestException('当前订单状态不允许取消');
        }
        const now = new Date();
        const updated = await this.db
            .update(schema_1.mallOrders)
            .set({
            status: api_interface_1.MALL_ORDER_STATUS.CANCELLED,
            cancelledAt: now,
            cancelReason: '后台取消',
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id))
            .returning();
        this.logger.log(`后台取消商城订单: orderId=${id}`);
        return this.toMallOrderInfo(updated[0]);
    }
    toUserInfo(user) {
        return {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl ?? undefined,
            gender: user.gender ?? undefined,
            level: user.level,
            isInvited: user.isInvited,
            inviterId: user.inviterId ?? undefined,
            parentId: user.parentId ?? undefined,
            inviteCode: user.inviteCode ?? undefined,
            receiveAddress: user.receiveAddress ?? undefined,
            receivePhone: user.receivePhone ?? undefined,
            industry: user.industry ?? undefined,
            qualification: user.qualification ?? undefined,
            serviceStandard: user.serviceStandard ?? undefined,
            wechatQrcodeUrl: user.wechatQrcodeUrl ?? undefined,
            alipayQrcodeUrl: user.alipayQrcodeUrl ?? undefined,
            companyQrcodeUrl: user.companyQrcodeUrl ?? undefined,
            businessLicenseUrl: user.businessLicenseUrl ?? undefined,
            companyAuditStatus: user.companyAuditStatus ?? undefined,
            totalConsultIncome: String(user.totalConsultIncome),
            thresholdBlocked: user.thresholdBlocked,
            thresholdTriggeredAt: user.thresholdTriggeredAt
                ? user.thresholdTriggeredAt.toISOString()
                : undefined,
            pendingReclaimAmount: String(user.pendingReclaimAmount),
            overflowLossAmount: String(user.overflowLossAmount),
            directInviteCount: user.directInviteCount,
            teamTotalCount: user.teamTotalCount,
            treeLevel: user.treeLevel,
            createdAt: user.createdAt.toISOString(),
        };
    }
    async getUserList(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const offset = (page - 1) * pageSize;
        const conditions = [];
        if (params.level)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.users.level, params.level));
        if (params.keyword) {
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.users.nickname, `%${params.keyword}%`), (0, drizzle_orm_1.ilike)(schema_1.users.phone, `%${params.keyword}%`)));
        }
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where(whereClause),
            this.db
                .select()
                .from(schema_1.users)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.users.createdAt))
                .limit(pageSize)
                .offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            items: itemsRaw.map((item) => this.toUserInfo(item)),
            total,
            page,
            pageSize,
        };
    }
    async getUserDetail(id) {
        const userRows = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
        if (userRows.length === 0)
            throw new common_1.NotFoundException('用户不存在');
        return this.toUserInfo(userRows[0]);
    }
    async getCompanyAuditList(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const offset = (page - 1) * pageSize;
        const whereClause = (0, drizzle_orm_1.eq)(schema_1.users.companyAuditStatus, 'pending');
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where(whereClause),
            this.db
                .select()
                .from(schema_1.users)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.users.createdAt))
                .limit(pageSize)
                .offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            items: itemsRaw.map((item) => this.toUserInfo(item)),
            total,
            page,
            pageSize,
        };
    }
    async reviewCompanyAudit(id, dto) {
        const userRows = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
        const user = userRows[0];
        if (!user)
            throw new common_1.NotFoundException('用户不存在');
        if (user.companyAuditStatus !== 'pending') {
            throw new common_1.BadRequestException('当前状态不允许审核');
        }
        const newStatus = dto.passed ? 'approved' : 'rejected';
        if (dto.passed && user.level === api_interface_1.LEVELS.LEVEL_7) {
            const lastTaskRows = await this.db
                .select()
                .from(schema_1.upgradeTasks)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.userId, id), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.toLevel, api_interface_1.LEVELS.LEVEL_7)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.upgradeTasks.taskIndex))
                .limit(1);
            const lastTask = lastTaskRows[0];
            if (lastTask && lastTask.status === api_interface_1.TASK_STATUS.COMPLETED) {
                const updated = await this.db
                    .update(schema_1.users)
                    .set({
                    companyAuditStatus: newStatus,
                    level: api_interface_1.LEVELS.LEVEL_8,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
                    .returning();
                this.logger.log(`公司资质审核通过并升级: userId=${id}, level=${api_interface_1.LEVELS.LEVEL_8}`);
                return this.toUserInfo(updated[0]);
            }
        }
        const updated = await this.db
            .update(schema_1.users)
            .set({ companyAuditStatus: newStatus })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
            .returning();
        this.logger.log(`公司资质审核: userId=${id}, passed=${dto.passed}`);
        return this.toUserInfo(updated[0]);
    }
    async getPlatformQrcode(type) {
        const rows = await this.db
            .select()
            .from(schema_1.platformQrcodes)
            .where((0, drizzle_orm_1.eq)(schema_1.platformQrcodes.type, type))
            .limit(1);
        if (rows.length === 0) {
            return {
                id: '',
                type,
                wechatQrcodeUrl: undefined,
                alipayQrcodeUrl: undefined,
            };
        }
        const qr = rows[0];
        return {
            id: qr.id,
            type: qr.type,
            wechatQrcodeUrl: qr.wechatQrcodeUrl ?? undefined,
            alipayQrcodeUrl: qr.alipayQrcodeUrl ?? undefined,
        };
    }
    async updatePlatformQrcode(type, dto) {
        const existing = await this.db
            .select({ id: schema_1.platformQrcodes.id })
            .from(schema_1.platformQrcodes)
            .where((0, drizzle_orm_1.eq)(schema_1.platformQrcodes.type, type))
            .limit(1);
        if (existing.length === 0) {
            const inserted = await this.db
                .insert(schema_1.platformQrcodes)
                .values({
                type,
                wechatQrcodeUrl: dto.wechatQrcodeUrl ?? null,
                alipayQrcodeUrl: dto.alipayQrcodeUrl ?? null,
            })
                .returning();
            const qr = inserted[0];
            this.logger.log(`创建平台收款码: type=${type}`);
            return {
                id: qr.id,
                type: qr.type,
                wechatQrcodeUrl: qr.wechatQrcodeUrl ?? undefined,
                alipayQrcodeUrl: qr.alipayQrcodeUrl ?? undefined,
            };
        }
        const patch = {};
        if (dto.wechatQrcodeUrl !== undefined)
            patch.wechatQrcodeUrl = dto.wechatQrcodeUrl;
        if (dto.alipayQrcodeUrl !== undefined)
            patch.alipayQrcodeUrl = dto.alipayQrcodeUrl;
        if (Object.keys(patch).length === 0) {
            return this.getPlatformQrcode(type);
        }
        const updated = await this.db
            .update(schema_1.platformQrcodes)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(schema_1.platformQrcodes.type, type))
            .returning();
        const qr = updated[0];
        this.logger.log(`更新平台收款码: type=${type}`);
        return {
            id: qr.id,
            type: qr.type,
            wechatQrcodeUrl: qr.wechatQrcodeUrl ?? undefined,
            alipayQrcodeUrl: qr.alipayQrcodeUrl ?? undefined,
        };
    }
    toConsultOrderInfo(order) {
        return {
            id: order.id,
            orderNo: order.orderNo,
            studentId: order.studentId,
            consultantId: order.consultantId,
            serviceType: order.serviceType,
            amount: String(order.amount),
            taskLevelFrom: order.taskLevelFrom ?? undefined,
            taskLevelTo: order.taskLevelTo ?? undefined,
            taskIndex: order.taskIndex ?? undefined,
            status: order.status,
            paymentScreenshotUrl: order.paymentScreenshotUrl ?? undefined,
            paymentConfirmedAt: order.paymentConfirmedAt
                ? order.paymentConfirmedAt.toISOString()
                : undefined,
            workScreenshotUrl: order.workScreenshotUrl ?? undefined,
            workSubmittedAt: order.workSubmittedAt ? order.workSubmittedAt.toISOString() : undefined,
            workReviewedAt: order.workReviewedAt ? order.workReviewedAt.toISOString() : undefined,
            reviewRemark: order.reviewRemark ?? undefined,
            isOverflow: order.isOverflow,
            overflowToGroup: order.overflowToGroup,
            autoConfirmDeadline: order.autoConfirmDeadline
                ? order.autoConfirmDeadline.toISOString()
                : undefined,
            createdAt: order.createdAt.toISOString(),
        };
    }
    async getConsultOrderList(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const offset = (page - 1) * pageSize;
        const conditions = [];
        if (params.status)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.consultOrders.status, params.status));
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.consultOrders).where(whereClause),
            this.db
                .select()
                .from(schema_1.consultOrders)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.consultOrders.createdAt))
                .limit(pageSize)
                .offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            items: itemsRaw.map((item) => this.toConsultOrderInfo(item)),
            total,
            page,
            pageSize,
        };
    }
    async getFinanceInfo(userId) {
        const userRows = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (userRows.length === 0)
            throw new common_1.NotFoundException('用户不存在');
        const user = userRows[0];
        const incomeRows = await this.db
            .select({
            total: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.consultOrders.amount}), '0')`,
        })
            .from(schema_1.consultOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.consultOrders.consultantId, userId), (0, drizzle_orm_1.eq)(schema_1.consultOrders.status, api_interface_1.CONSULT_ORDER_STATUS.COMPLETED)));
        const totalConsultIncome = String(incomeRows[0]?.total ?? '0');
        return {
            totalConsultIncome,
            pendingReclaimAmount: String(user.pendingReclaimAmount),
            overflowLossAmount: String(user.overflowLossAmount),
            thresholdBlocked: user.thresholdBlocked,
            thresholdTriggeredAt: user.thresholdTriggeredAt
                ? user.thresholdTriggeredAt.toISOString()
                : undefined,
            directInviteCount: user.directInviteCount,
            wechatQrcodeUrl: user.wechatQrcodeUrl ?? undefined,
            alipayQrcodeUrl: user.alipayQrcodeUrl ?? undefined,
            companyQrcodeUrl: user.companyQrcodeUrl ?? undefined,
            level: user.level,
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = AdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, products_service_1.ProductsService,
        upgrade_service_1.UpgradeService])
], AdminService);
//# sourceMappingURL=admin.service.js.map