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
var SellersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellersService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../database/database.module");
const schema_1 = require("../../database/schema");
const api_interface_1 = require("../../../shared/api.interface");
let SellersService = SellersService_1 = class SellersService {
    db;
    logger = new common_1.Logger(SellersService_1.name);
    constructor(db) {
        this.db = db;
    }
    async assertApprovedSeller(userId) {
        const rows = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        const user = rows[0];
        if (!user) {
            throw new common_1.NotFoundException('用户不存在');
        }
        if (!user.isSeller || user.sellerStatus !== api_interface_1.SELLER_STATUS.APPROVED) {
            throw new common_1.ForbiddenException('您不是已通过审核的商家');
        }
        return user;
    }
    toProductInfo(row) {
        return {
            id: row.id,
            name: row.name,
            price: String(row.price),
            description: row.description ?? undefined,
            category: row.category ?? undefined,
            spec: row.spec ?? undefined,
            sellerId: row.sellerId ?? undefined,
            sellerName: row.sellerName ?? undefined,
            sellerWechatQrcodeUrl: row.sellerWechatQrcodeUrl ?? undefined,
            sellerAlipayQrcodeUrl: row.sellerAlipayQrcodeUrl ?? undefined,
            mainImages: row.mainImages,
            detailImages: row.detailImages,
            status: row.status,
            sortOrder: row.sortOrder,
            createdAt: row.createdAt.toISOString(),
        };
    }
    toFeeInfo(row) {
        return {
            id: row.id,
            sellerId: row.sellerId,
            sellerName: row.sellerName ?? undefined,
            feeDate: row.feeDate.toISOString(),
            totalSales: String(row.totalSales),
            feeAmount: String(row.feeAmount),
            status: row.status,
            paymentScreenshotUrl: row.paymentScreenshotUrl ?? undefined,
            paidAt: row.paidAt ? row.paidAt.toISOString() : undefined,
            confirmedBy: row.confirmedBy ?? undefined,
            confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : undefined,
            deadline: row.deadline ? row.deadline.toISOString() : undefined,
            createdAt: row.createdAt.toISOString(),
        };
    }
    beijingNow() {
        const bj = new Date(Date.now() + 8 * 3600 * 1000);
        return {
            year: bj.getUTCFullYear(),
            month0: bj.getUTCMonth(),
            date: bj.getUTCDate(),
        };
    }
    bjMidnight(year, month0, date) {
        return new Date(Date.UTC(year, month0, date, 0, 0, 0) - 8 * 3600 * 1000);
    }
    async getSellerProducts(sellerId, page, pageSize, status) {
        await this.assertApprovedSeller(sellerId);
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.products.sellerId, sellerId)];
        if (status)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.products.status, status));
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.products).where(whereClause),
            this.db
                .select()
                .from(schema_1.products)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            items: itemsRaw.map((item) => this.toProductInfo(item)),
            total,
            page,
            pageSize,
        };
    }
    async createSellerProduct(sellerId, dto) {
        const seller = await this.assertApprovedSeller(sellerId);
        const inserted = await this.db
            .insert(schema_1.products)
            .values({
            name: dto.name,
            price: dto.price,
            description: dto.description ?? null,
            category: dto.category ?? null,
            spec: dto.spec ?? null,
            mainImages: dto.mainImages,
            detailImages: dto.detailImages,
            status: api_interface_1.PRODUCT_STATUS.ON_SALE,
            sortOrder: dto.sortOrder ?? 0,
            sellerId,
            sellerName: seller.nickname,
            sellerWechatQrcodeUrl: dto.sellerWechatQrcodeUrl ?? null,
            sellerAlipayQrcodeUrl: dto.sellerAlipayQrcodeUrl ?? null,
        })
            .returning();
        this.logger.log(`商家创建商品: sellerId=${sellerId}, productId=${inserted[0].id}`);
        return this.toProductInfo(inserted[0]);
    }
    async updateSellerProduct(sellerId, productId, dto) {
        await this.assertApprovedSeller(sellerId);
        const rows = await this.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, productId)).limit(1);
        const product = rows[0];
        if (!product)
            throw new common_1.NotFoundException('商品不存在');
        if (product.sellerId !== sellerId)
            throw new common_1.ForbiddenException('无权编辑该商品');
        const patch = {};
        if (dto.name !== undefined)
            patch.name = dto.name;
        if (dto.price !== undefined)
            patch.price = dto.price;
        if (dto.description !== undefined)
            patch.description = dto.description;
        if (dto.category !== undefined)
            patch.category = dto.category;
        if (dto.spec !== undefined)
            patch.spec = dto.spec;
        if (dto.mainImages !== undefined) {
            patch.mainImages = dto.mainImages;
        }
        if (dto.detailImages !== undefined) {
            patch.detailImages = dto.detailImages;
        }
        if (dto.sortOrder !== undefined)
            patch.sortOrder = dto.sortOrder;
        if (dto.sellerWechatQrcodeUrl !== undefined)
            patch.sellerWechatQrcodeUrl = dto.sellerWechatQrcodeUrl;
        if (dto.sellerAlipayQrcodeUrl !== undefined)
            patch.sellerAlipayQrcodeUrl = dto.sellerAlipayQrcodeUrl;
        if (Object.keys(patch).length === 0) {
            return this.toProductInfo(product);
        }
        const updated = await this.db
            .update(schema_1.products)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId))
            .returning();
        this.logger.log(`商家编辑商品: sellerId=${sellerId}, productId=${productId}`);
        return this.toProductInfo(updated[0]);
    }
    async toggleSellerProductStatus(sellerId, productId) {
        await this.assertApprovedSeller(sellerId);
        const rows = await this.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, productId)).limit(1);
        const product = rows[0];
        if (!product)
            throw new common_1.NotFoundException('商品不存在');
        if (product.sellerId !== sellerId)
            throw new common_1.ForbiddenException('无权操作该商品');
        if (product.status === api_interface_1.PRODUCT_STATUS.WAREHOUSE) {
            throw new common_1.BadRequestException('违规下架商品不可自行恢复，请联系管理员');
        }
        const nextStatus = product.status === api_interface_1.PRODUCT_STATUS.ON_SALE ? api_interface_1.PRODUCT_STATUS.OFF_SHELF : api_interface_1.PRODUCT_STATUS.ON_SALE;
        const updated = await this.db
            .update(schema_1.products)
            .set({ status: nextStatus })
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId))
            .returning();
        this.logger.log(`商家上下架商品: sellerId=${sellerId}, productId=${productId}, status=${nextStatus}`);
        return this.toProductInfo(updated[0]);
    }
    async getSellerOrders(sellerId, page, pageSize, status) {
        await this.assertApprovedSeller(sellerId);
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.mallOrders.sellerId, sellerId)];
        if (status)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.mallOrders.status, status));
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const [countResult, items] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.mallOrders).where(whereClause),
            this.db
                .select()
                .from(schema_1.mallOrders)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.mallOrders.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            items: items.map((item) => this.toOrderInfo(item)),
            total,
            page,
            pageSize,
        };
    }
    async sellerShipOrder(sellerId, orderId, dto) {
        await this.assertApprovedSeller(sellerId);
        const orderList = await this.db.select().from(schema_1.mallOrders).where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, orderId));
        const order = orderList[0];
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.sellerId !== sellerId)
            throw new common_1.ForbiddenException('无权操作该订单');
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
        const autoDeliveryDeadline = new Date(now);
        if (isNoLogistics) {
            autoDeliveryDeadline.setMinutes(autoDeliveryDeadline.getMinutes() + 20);
        }
        else {
            autoDeliveryDeadline.setDate(autoDeliveryDeadline.getDate() + 15);
        }
        const updated = await this.db
            .update(schema_1.mallOrders)
            .set({
            status: api_interface_1.MALL_ORDER_STATUS.PENDING_DELIVERY,
            logisticsCompany: dto.logisticsCompany,
            logisticsNo: isNoLogistics ? null : dto.logisticsNo,
            shippedAt: now,
            autoDeliveryDeadline,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, orderId))
            .returning();
        this.logger.log(`商家发货: sellerId=${sellerId}, orderId=${orderId}`);
        return this.toOrderInfo(updated[0]);
    }
    toOrderInfo(order) {
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
            sellerId: order.sellerId ?? undefined,
            sellerName: order.sellerName ?? undefined,
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
            autoDeliveryDeadline: order.autoDeliveryDeadline
                ? order.autoDeliveryDeadline.toISOString()
                : undefined,
            createdAt: order.createdAt.toISOString(),
        };
    }
    async getSellerManagementFees(sellerId, page, pageSize, status) {
        await this.assertApprovedSeller(sellerId);
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.managementFees.sellerId, sellerId)];
        if (status)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.managementFees.status, status));
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.managementFees).where(whereClause),
            this.db
                .select()
                .from(schema_1.managementFees)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.managementFees.feeDate))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            items: itemsRaw.map((item) => this.toFeeInfo(item)),
            total,
            page,
            pageSize,
        };
    }
    async payManagementFee(sellerId, feeId, screenshotUrl) {
        await this.assertApprovedSeller(sellerId);
        if (!screenshotUrl) {
            throw new common_1.BadRequestException('支付凭证不能为空');
        }
        const rows = await this.db.select().from(schema_1.managementFees).where((0, drizzle_orm_1.eq)(schema_1.managementFees.id, feeId)).limit(1);
        const fee = rows[0];
        if (!fee)
            throw new common_1.NotFoundException('管理费记录不存在');
        if (fee.sellerId !== sellerId)
            throw new common_1.ForbiddenException('无权操作该管理费');
        if (fee.status !== api_interface_1.MANAGEMENT_FEE_STATUS.PENDING) {
            throw new common_1.BadRequestException('当前管理费状态不允许支付');
        }
        const updated = await this.db
            .update(schema_1.managementFees)
            .set({
            status: api_interface_1.MANAGEMENT_FEE_STATUS.PAID,
            paymentScreenshotUrl: screenshotUrl,
            paidAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.managementFees.id, feeId))
            .returning();
        this.logger.log(`商家支付管理费: sellerId=${sellerId}, feeId=${feeId}`);
        return this.toFeeInfo(updated[0]);
    }
    async getSellerStats(sellerId) {
        await this.assertApprovedSeller(sellerId);
        const { year, month0, date } = this.beijingNow();
        const todayStart = this.bjMidnight(year, month0, date);
        const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);
        const soldStatuses = [
            api_interface_1.MALL_ORDER_STATUS.PENDING_SHIPMENT,
            api_interface_1.MALL_ORDER_STATUS.PENDING_DELIVERY,
            api_interface_1.MALL_ORDER_STATUS.COMPLETED,
        ];
        const [totalProductsRow, onSaleRow, todaySalesRow, todayOrdersRow, pendingFeeRow, totalSalesRow] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.eq)(schema_1.products.sellerId, sellerId)),
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.sellerId, sellerId), (0, drizzle_orm_1.eq)(schema_1.products.status, api_interface_1.PRODUCT_STATUS.ON_SALE))),
            this.db
                .select({ total: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.mallOrders.totalAmount}), '0')` })
                .from(schema_1.mallOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.mallOrders.sellerId, sellerId), (0, drizzle_orm_1.gte)(schema_1.mallOrders.paymentConfirmedAt, todayStart), (0, drizzle_orm_1.lt)(schema_1.mallOrders.paymentConfirmedAt, tomorrowStart), (0, drizzle_orm_1.inArray)(schema_1.mallOrders.status, soldStatuses))),
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.mallOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.mallOrders.sellerId, sellerId), (0, drizzle_orm_1.gte)(schema_1.mallOrders.paymentConfirmedAt, todayStart), (0, drizzle_orm_1.lt)(schema_1.mallOrders.paymentConfirmedAt, tomorrowStart), (0, drizzle_orm_1.inArray)(schema_1.mallOrders.status, soldStatuses))),
            this.db
                .select({
                total: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.managementFees.feeAmount}), '0')`,
                count: (0, drizzle_orm_1.count)(),
            })
                .from(schema_1.managementFees)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.managementFees.sellerId, sellerId), (0, drizzle_orm_1.eq)(schema_1.managementFees.status, api_interface_1.MANAGEMENT_FEE_STATUS.PENDING))),
            this.db
                .select({ total: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.mallOrders.totalAmount}), '0')` })
                .from(schema_1.mallOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.mallOrders.sellerId, sellerId), (0, drizzle_orm_1.inArray)(schema_1.mallOrders.status, soldStatuses))),
        ]);
        return {
            totalProducts: Number(totalProductsRow[0]?.count ?? 0),
            onSaleProducts: Number(onSaleRow[0]?.count ?? 0),
            todaySales: String(todaySalesRow[0]?.total ?? '0'),
            todayOrders: Number(todayOrdersRow[0]?.count ?? 0),
            pendingFees: String(pendingFeeRow[0]?.total ?? '0'),
            pendingFeeCount: Number(pendingFeeRow[0]?.count ?? 0),
            totalSalesAll: String(totalSalesRow[0]?.total ?? '0'),
        };
    }
    async applySeller(userId, dto) {
        const rows = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        const user = rows[0];
        if (!user)
            throw new common_1.NotFoundException('用户不存在');
        if (user.isSeller && user.sellerStatus === api_interface_1.SELLER_STATUS.APPROVED) {
            return { success: true, sellerStatus: api_interface_1.SELLER_STATUS.APPROVED };
        }
        if (user.isSeller && user.sellerStatus === api_interface_1.SELLER_STATUS.PENDING) {
            return { success: true, sellerStatus: api_interface_1.SELLER_STATUS.PENDING };
        }
        const patch = {
            isSeller: true,
            sellerStatus: api_interface_1.SELLER_STATUS.PENDING,
        };
        if (dto.realName)
            patch.realName = dto.realName;
        if (dto.wechatId)
            patch.wechatId = dto.wechatId;
        if (dto.businessLicenseUrl)
            patch.businessLicenseUrl = dto.businessLicenseUrl;
        await this.db.update(schema_1.users).set(patch).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        this.logger.log(`申请成为商家: userId=${userId}, realName=${dto.realName ?? ''}`);
        return { success: true, sellerStatus: api_interface_1.SELLER_STATUS.PENDING };
    }
};
exports.SellersService = SellersService;
exports.SellersService = SellersService = SellersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], SellersService);
//# sourceMappingURL=sellers.service.js.map