import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { eq, and, desc, count } from 'drizzle-orm';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { mallOrders, products } from '@server/database/schema';
import { generateOrderNo } from '@server/common/utils/auth.util';
import { MALL_ORDER_STATUS } from '@shared/api.interface';
import type {
  MallOrderInfo,
  CreateMallOrderDTO,
  MallOrderListResponse,
  PaymentScreenshotDTO,
} from '@shared/api.interface';

@Injectable()
export class MallOrdersService {
  private readonly logger = new Logger(MallOrdersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private toOrderInfo(order: typeof mallOrders.$inferSelect): MallOrderInfo {
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

  async create(userId: string, dto: CreateMallOrderDTO): Promise<MallOrderInfo> {
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('商品数量必须大于0');
    }

    const productList = await this.db
      .select()
      .from(products)
      .where(eq(products.id, dto.productId));

    const product = productList[0];
    if (!product) {
      throw new NotFoundException('商品不存在');
    }
    if (product.status !== 'on_sale') {
      throw new BadRequestException('商品已下架');
    }

    const priceNum = Number(product.price);
    const totalAmount = (priceNum * dto.quantity).toFixed(2);

    const mainImages = (product.mainImages as { url: string }[]) || [];
    const productImage = mainImages.length > 0 ? mainImages[0].url : null;

    const orderNo = generateOrderNo('M');

    const inserted = await this.db
      .insert(mallOrders)
      .values({
        orderNo,
        userId,
        productId: dto.productId,
        productName: product.name,
        productImage,
        price: product.price as string,
        quantity: dto.quantity,
        totalAmount,
        receiveName: dto.receiveName,
        receivePhone: dto.receivePhone,
        receiveAddress: dto.receiveAddress,
        status: MALL_ORDER_STATUS.PENDING_PAYMENT,
      })
      .returning();

    this.logger.log(`创建商城订单: orderNo=${orderNo}, userId=${userId}`);
    return this.toOrderInfo(inserted[0]);
  }

  async getMyOrders(
    userId: string,
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<MallOrderListResponse> {
    const conditions = [eq(mallOrders.userId, userId)];
    if (status) {
      conditions.push(eq(mallOrders.status, status));
    }

    const whereClause = and(...conditions);

    const [countResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(mallOrders)
        .where(whereClause),
      this.db
        .select()
        .from(mallOrders)
        .where(whereClause)
        .orderBy(desc(mallOrders.createdAt))
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

  async getOrderDetail(userId: string, id: string): Promise<MallOrderInfo> {
    const orderList = await this.db
      .select()
      .from(mallOrders)
      .where(eq(mallOrders.id, id));

    const order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('无权查看该订单');
    }

    return this.toOrderInfo(order);
  }

  async uploadPaymentScreenshot(
    userId: string,
    id: string,
    dto: PaymentScreenshotDTO,
  ): Promise<MallOrderInfo> {
    const orderList = await this.db
      .select()
      .from(mallOrders)
      .where(eq(mallOrders.id, id));

    const order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (order.status !== MALL_ORDER_STATUS.PENDING_PAYMENT) {
      throw new BadRequestException('当前订单状态不允许上传付款凭证');
    }

    const autoConfirmDeadline = new Date();
    autoConfirmDeadline.setMinutes(autoConfirmDeadline.getMinutes() + 20);

    const updated = await this.db
      .update(mallOrders)
      .set({
        paymentScreenshotUrl: dto.screenshotUrl,
        status: MALL_ORDER_STATUS.PENDING_REVIEW,
        autoConfirmDeadline,
      })
      .where(eq(mallOrders.id, id))
      .returning();

    this.logger.log(`订单付款凭证已上传: orderId=${id}, status=${MALL_ORDER_STATUS.PENDING_REVIEW}`);
    return this.toOrderInfo(updated[0]);
  }

  async confirmDelivery(userId: string, id: string): Promise<MallOrderInfo> {
    const orderList = await this.db
      .select()
      .from(mallOrders)
      .where(eq(mallOrders.id, id));

    const order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (order.status !== MALL_ORDER_STATUS.PENDING_DELIVERY) {
      throw new BadRequestException('当前订单状态不允许确认收货');
    }

    const now = new Date();
    const updated = await this.db
      .update(mallOrders)
      .set({
        status: MALL_ORDER_STATUS.COMPLETED,
        deliveredAt: now,
      })
      .where(eq(mallOrders.id, id))
      .returning();

    this.logger.log(`订单确认收货: orderId=${id}`);
    return this.toOrderInfo(updated[0]);
  }
}
