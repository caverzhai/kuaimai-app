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
var MallOrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MallOrdersService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../database/database.module");
const schema_1 = require("@server/database/schema");
const auth_util_1 = require("@server/common/utils/auth.util");
const api_interface_1 = require("@shared/api.interface");
let MallOrdersService = MallOrdersService_1 = class MallOrdersService {
    db;
    logger = new common_1.Logger(MallOrdersService_1.name);
    constructor(db) {
        this.db = db;
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
    async create(userId, dto) {
        if (!dto.quantity || dto.quantity <= 0) {
            throw new common_1.BadRequestException('商品数量必须大于0');
        }
        const productList = await this.db
            .select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, dto.productId));
        const product = productList[0];
        if (!product) {
            throw new common_1.NotFoundException('商品不存在');
        }
        if (product.status !== 'on_sale') {
            throw new common_1.BadRequestException('商品已下架');
        }
        const priceNum = Number(product.price);
        const totalAmount = (priceNum * dto.quantity).toFixed(2);
        const mainImages = product.mainImages || [];
        const productImage = mainImages.length > 0 ? mainImages[0].url : null;
        const orderNo = (0, auth_util_1.generateOrderNo)('M');
        const inserted = await this.db
            .insert(schema_1.mallOrders)
            .values({
            orderNo,
            userId,
            productId: dto.productId,
            productName: product.name,
            productImage,
            price: product.price,
            quantity: dto.quantity,
            totalAmount,
            receiveName: dto.receiveName,
            receivePhone: dto.receivePhone,
            receiveAddress: dto.receiveAddress,
            status: api_interface_1.MALL_ORDER_STATUS.PENDING_PAYMENT,
        })
            .returning();
        this.logger.log(`创建商城订单: orderNo=${orderNo}, userId=${userId}`);
        return this.toOrderInfo(inserted[0]);
    }
    async getMyOrders(userId, page, pageSize, status) {
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.mallOrders.userId, userId)];
        if (status) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.mallOrders.status, status));
        }
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const [countResult, items] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.mallOrders)
                .where(whereClause),
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
    async getOrderDetail(userId, id) {
        const orderList = await this.db
            .select()
            .from(schema_1.mallOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.userId !== userId) {
            throw new common_1.ForbiddenException('无权查看该订单');
        }
        return this.toOrderInfo(order);
    }
    async uploadPaymentScreenshot(userId, id, dto) {
        const orderList = await this.db
            .select()
            .from(schema_1.mallOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.userId !== userId) {
            throw new common_1.ForbiddenException('无权操作该订单');
        }
        if (order.status !== api_interface_1.MALL_ORDER_STATUS.PENDING_PAYMENT) {
            throw new common_1.BadRequestException('当前订单状态不允许上传付款凭证');
        }
        const autoConfirmDeadline = new Date();
        autoConfirmDeadline.setMinutes(autoConfirmDeadline.getMinutes() + 20);
        const updated = await this.db
            .update(schema_1.mallOrders)
            .set({
            paymentScreenshotUrl: dto.screenshotUrl,
            status: api_interface_1.MALL_ORDER_STATUS.PENDING_REVIEW,
            autoConfirmDeadline,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id))
            .returning();
        this.logger.log(`订单付款凭证已上传: orderId=${id}, status=${api_interface_1.MALL_ORDER_STATUS.PENDING_REVIEW}`);
        return this.toOrderInfo(updated[0]);
    }
    async confirmDelivery(userId, id) {
        const orderList = await this.db
            .select()
            .from(schema_1.mallOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.userId !== userId) {
            throw new common_1.ForbiddenException('无权操作该订单');
        }
        if (order.status !== api_interface_1.MALL_ORDER_STATUS.PENDING_DELIVERY) {
            throw new common_1.BadRequestException('当前订单状态不允许确认收货');
        }
        const now = new Date();
        const updated = await this.db
            .update(schema_1.mallOrders)
            .set({
            status: api_interface_1.MALL_ORDER_STATUS.COMPLETED,
            deliveredAt: now,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.mallOrders.id, id))
            .returning();
        this.logger.log(`订单确认收货: orderId=${id}`);
        return this.toOrderInfo(updated[0]);
    }
};
exports.MallOrdersService = MallOrdersService;
exports.MallOrdersService = MallOrdersService = MallOrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], MallOrdersService);
//# sourceMappingURL=mall-orders.service.js.map