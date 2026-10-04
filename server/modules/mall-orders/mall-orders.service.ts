import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { mallOrders, products, users, platformQrcodes } from '@server/database/schema';
import { generateOrderNo } from '@server/common/utils/auth.util';
import { findPendingPayment, buildPendingPaymentError } from '@server/common/utils/pending-order.util';
import { MALL_ORDER_STATUS } from '@shared/api.interface';
import { UpgradeService } from '../upgrade/upgrade.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  MallOrderInfo,
  CreateMallOrderDTO,
  MallOrderListResponse,
  PaymentScreenshotDTO,
} from '@shared/api.interface';

@Injectable()
export class MallOrdersService {
  private readonly logger = new Logger(MallOrdersService.name);

  // 平台自营商品（无卖家）的订单，收款提醒发给平台管理员
  private static readonly ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly upgradeService: UpgradeService,
    private readonly notificationsService: NotificationsService,
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
      autoDeliveryDeadline: order.autoDeliveryDeadline
        ? order.autoDeliveryDeadline.toISOString()
        : undefined,
      sellerId: (order as any).sellerId ?? undefined,
      createdAt: order.createdAt.toISOString(),
    };
  }

  async create(userId: string, dto: CreateMallOrderDTO): Promise<MallOrderInfo> {
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('商品数量必须大于0');
    }

    // 未绑定邀请人（无有效邀请码）的账号禁止下单/开始任务，需先补充邀请码激活
    const buyerRows = await this.db
      .select({ isInvited: users.isInvited })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!buyerRows[0]?.isInvited) {
      throw new BadRequestException('您还未绑定邀请人，无法下单或开始任务。请先到「任务中心」补充邀请码激活账号');
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
      throw new BadRequestException('商品已下架或不在售卖中，无法下单，请返回重新选择其它商品');
    }

    // 卖家不能购买自己上架的商品
    const productSellerId = (product as any).sellerId;
    if (productSellerId && productSellerId === userId) {
      throw new BadRequestException('不能购买自己上架的商品：该商品由您本人作为卖家发布，无需自行下单购买');
    }

    // 全局待付款检查（商城订单 + 咨询单）：有任一未付款订单时禁止再下单
    const pending = await findPendingPayment(this.db, userId);
    if (pending) {
      throw new BadRequestException(buildPendingPaymentError(pending));
    }

    // 仅当存在"已传付款凭证、卖家尚未确认收款"的订单时，禁止再次下单（防止重复拍）；
    // 已确认收款的待发货 / 待收货订单不拦截，不影响继续下一单或下一任务
    const activeMall = await this.db
      .select({ orderNo: mallOrders.orderNo, status: mallOrders.status })
      .from(mallOrders)
      .where(
        and(
          eq(mallOrders.userId, userId),
          inArray(mallOrders.status, [
            MALL_ORDER_STATUS.PENDING_REVIEW,
          ]),
        ),
      )
      .limit(1);
    if (activeMall.length > 0) {
      const statusNameMap: Record<string, string> = {
        pending_review: '已上传付款凭证、等待卖家确认收款',
        pending_shipment: '卖家已收款、待发货',
        pending_delivery: '卖家已发货、待收货',
      };
      throw new BadRequestException(
        `您上一笔商城订单（订单号：${activeMall[0].orderNo}）尚未完成（当前状态：${statusNameMap[activeMall[0].status]}）。请在「我的订单」中完成该订单（确认收货）后，才能再次购买，避免产生重复订单。`,
      );
    }

    const priceNum = Number(product.price);
    const totalAmount = (priceNum * dto.quantity).toFixed(2);

    const mainImages = (product.mainImages as { url: string }[]) || [];
    const productImage = mainImages.length > 0 ? mainImages[0].url : null;

    const orderNo = generateOrderNo('M');

    let inserted;
    try {
      inserted = await this.db
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
          sellerId: (product as any).sellerId || null,
        })
        .returning();
    } catch (dbErr) {
      this.logger.error(`创建商城订单数据库失败: userId=${userId}, productId=${dto.productId}, sellerId=${(product as any).sellerId || null}, receiveName=${dto.receiveName}, error=${(dbErr as Error).message}`);
      throw dbErr;
    }

    this.logger.log(`创建商城订单: orderNo=${orderNo}, userId=${userId}, product=${product.name}, amount=${totalAmount}`);
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
    autoConfirmDeadline.setSeconds(autoConfirmDeadline.getSeconds() + 180);

    const updated = await this.db
      .update(mallOrders)
      .set({
        paymentScreenshotUrl: dto.screenshotUrl,
        status: MALL_ORDER_STATUS.PENDING_REVIEW,
        autoConfirmDeadline,
      })
      .where(eq(mallOrders.id, id))
      .returning();

    // 实时标记升级任务"已传凭证"，立即解锁下一任务（不等审核通过，金额匹配）
    try {
      await this.upgradeService.markMallTaskSubmitted(userId, String(updated[0].totalAmount));
    } catch (e) {
      this.logger.error(`标记商城任务已传凭证失败: ${e}`);
    }

    // 收款/发货提醒：推送给卖家（平台自营订单发给管理员）
    try {
      const mo = updated[0];
      const amountYuan = Number(mo.totalAmount).toFixed(2);
      const targetSeller = (mo as any).sellerId || MallOrdersService.ADMIN_ID;
      await this.notificationsService.createCollect(
        targetSeller,
        'AI快卖·您有新订单待收款',
        `商品「${mo.productName}」x${mo.quantity}，¥${amountYuan}，买家已上传付款凭证，请确认收款并发货`,
        { kind: 'mall', orderId: mo.id, amount: amountYuan, sellerId: targetSeller },
      );
    } catch (e) {
      this.logger.error(`推送新订单提醒失败: ${e}`);
    }

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

  /** 管理员确认收款 */
  async confirmPayment(operatorPhone: string, id: string): Promise<MallOrderInfo> {
    const ADMIN_PHONES = ['13800000000'];
    if (!ADMIN_PHONES.includes(operatorPhone)) {
      throw new ForbiddenException('只有管理员可以确认收款');
    }

    const orderList = await this.db
      .select()
      .from(mallOrders)
      .where(eq(mallOrders.id, id));

    const order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== MALL_ORDER_STATUS.PENDING_REVIEW) {
      throw new BadRequestException('当前订单状态不允许确认收款');
    }

    const now = new Date();
    const updated = await this.db
      .update(mallOrders)
      .set({
        status: MALL_ORDER_STATUS.PENDING_SHIPMENT,
        paymentConfirmedAt: now,
      })
      .where(eq(mallOrders.id, id))
      .returning();

    this.logger.log(`商城订单确认收款: orderId=${id}, 状态变为待发货`);

    // 确认收款后，自动完成用户的商城购买升级任务
    try {
      await this.upgradeService.checkMallTaskComplete(order.userId, id, order.totalAmount);
      this.logger.log(`已检查并完成商城购买升级任务: userId=${order.userId}, orderId=${id}`);
    } catch (taskError) {
      this.logger.error(`完成商城购买升级任务失败: ` + taskError.message);
    }

    return this.toOrderInfo(updated[0]);
  }

  /** 管理员获取所有订单 */
  async getAllOrders(operatorPhone: string, page: number, pageSize: number, status?: string): Promise<MallOrderListResponse> {
    const ADMIN_PHONES = ['13800000000'];
    if (!ADMIN_PHONES.includes(operatorPhone)) {
      throw new ForbiddenException('只有管理员可以查看所有订单');
    }

    const conditions = [];
    if (status) {
      conditions.push(eq(mallOrders.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

  /** 卖家获取自己商品的订单 */
  async getSellerOrders(sellerId: string, page: number, pageSize: number, status?: string): Promise<MallOrderListResponse> {
    const conditions = [eq(mallOrders.sellerId, sellerId)];
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

  /** 卖家确认自己商品订单的收款 */
  async confirmSellerPayment(sellerId: string, id: string): Promise<MallOrderInfo> {
    const orderList = await this.db
      .select()
      .from(mallOrders)
      .where(eq(mallOrders.id, id));

    const order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    // 检查订单是否属于该卖家
    if ((order as any).sellerId !== sellerId) {
      throw new ForbiddenException('只能审核自己商品的订单');
    }
    if (order.status !== MALL_ORDER_STATUS.PENDING_REVIEW) {
      throw new BadRequestException('当前订单状态不允许确认收款');
    }

    const now = new Date();
    const updated = await this.db
      .update(mallOrders)
      .set({
        status: MALL_ORDER_STATUS.PENDING_SHIPMENT,
        paymentConfirmedAt: now,
      })
      .where(eq(mallOrders.id, id))
      .returning();

    this.logger.log('卖家确认收款: orderId=' + id + ', sellerId=' + sellerId);

    // 确认收款后，自动完成用户的商城购买升级任务（与管理员确认收款一致，一收到钱任务即完成）
    try {
      await this.upgradeService.checkMallTaskComplete(order.userId, id, order.totalAmount);
      this.logger.log(`已检查并完成商城购买升级任务: userId=${order.userId}, orderId=${id}`);
    } catch (taskError) {
      this.logger.error(`完成商城购买升级任务失败: ` + taskError.message);
    }

    return this.toOrderInfo(updated[0]);
  }

  /** 卖家发货（支持快递物流 / 无需物流 / 到店自提） */
  async shipSellerOrder(
    sellerId: string,
    id: string,
    dto: { logisticsCompany?: string; logisticsNo?: string; shipType?: string },
  ): Promise<MallOrderInfo> {
    const orderList = await this.db
      .select()
      .from(mallOrders)
      .where(eq(mallOrders.id, id));

    const order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if ((order as any).sellerId !== sellerId) {
      throw new ForbiddenException('只能给自己商品的订单发货');
    }
    if (order.status !== MALL_ORDER_STATUS.PENDING_SHIPMENT) {
      throw new BadRequestException('当前订单状态不允许发货');
    }

    // shipType: express（快递，默认）/ self_pickup（到店自提）/ no_logistics（无需物流）
    const shipType = dto.shipType || 'express';
    let logisticsCompany: string | null = null;
    let logisticsNo: string | null = null;

    if (shipType === 'express') {
      if (!dto.logisticsCompany || !dto.logisticsNo) {
        throw new BadRequestException('请填写物流公司和物流单号');
      }
      logisticsCompany = dto.logisticsCompany;
      logisticsNo = dto.logisticsNo;
    } else if (shipType === 'self_pickup') {
      logisticsCompany = '到店自提';
      logisticsNo = null;
    } else {
      logisticsCompany = '无需物流';
      logisticsNo = null;
    }

    const now = new Date();
    const autoDeliveryDeadline = new Date(now);
    if (shipType === 'express') {
      autoDeliveryDeadline.setDate(autoDeliveryDeadline.getDate() + 15);
    } else {
      // 自提/无需物流 180秒（3分钟）自动确认收货
      autoDeliveryDeadline.setSeconds(autoDeliveryDeadline.getSeconds() + 180);
    }

    const updated = await this.db
      .update(mallOrders)
      .set({
        status: MALL_ORDER_STATUS.PENDING_DELIVERY,
        logisticsCompany,
        logisticsNo,
        shippedAt: now,
        autoDeliveryDeadline,
      })
      .where(eq(mallOrders.id, id))
      .returning();

    this.logger.log('卖家发货: orderId=' + id + ', sellerId=' + sellerId + ', shipType=' + shipType);
    return this.toOrderInfo(updated[0]);
  }

  /** 定时任务：自动确认超时的收货（免物流180秒，有物流15天） */
  async autoDeliverExpiredOrdersCron(): Promise<{ delivered: number }> {
    const now = new Date();
    let delivered = 0;

    try {
      const expiredOrders = await this.db
        .select()
        .from(mallOrders)
        .where(
          and(
            eq(mallOrders.status, MALL_ORDER_STATUS.PENDING_DELIVERY),
            sql`${mallOrders.autoDeliveryDeadline} <= ${now}`,
          ),
        );

      if (expiredOrders.length > 0) {
        this.logger.log(`定时任务扫描到 ${expiredOrders.length} 个超时未收货订单`);
      }

      for (const order of expiredOrders) {
        try {
          await this.db.update(mallOrders).set({ status: MALL_ORDER_STATUS.COMPLETED, deliveredAt: now }).where(eq(mallOrders.id, order.id));
          delivered++;
        } catch (e) {
          this.logger.error(`定时任务自动收货失败: orderId=${order.id}, error=${e}`);
        }
      }

      if (delivered > 0) {
        this.logger.log(`定时任务完成: 商城订单自动收货${delivered}个`);
      }
    } catch (e) {
      this.logger.error(`定时任务扫描超时收货订单失败: ${e}`);
    }

    return { delivered };
  }

  /** 定时任务：自动确认超时的商城订单（180秒未审核自动确认） */
  async autoConfirmExpiredOrdersCron(): Promise<{ confirmed: number }> {
    const now = new Date();
    let confirmed = 0;

    try {
      const expiredOrders = await this.db
        .select()
        .from(mallOrders)
        .where(
          and(
            eq(mallOrders.status, MALL_ORDER_STATUS.PENDING_REVIEW),
            sql`${mallOrders.autoConfirmDeadline} <= ${now}`,
          ),
        );

      if (expiredOrders.length > 0) {
        this.logger.log(`定时任务扫描到 ${expiredOrders.length} 个超时商城订单`);
      }

      for (const order of expiredOrders) {
        try {
          await this.confirmPayment('13800000000', order.id);
          confirmed++;
        } catch (e) {
          this.logger.error(`定时任务确认商城订单失败: orderId=${order.id}, error=${e}`);
        }
      }

      if (confirmed > 0) {
        this.logger.log(`定时任务完成: 商城订单自动确认${confirmed}个`);
      }
    } catch (e) {
      this.logger.error(`定时任务扫描商城订单失败: ${e}`);
    }

    return { confirmed };
  }

  /** 定时任务：自动取消超时未付款的商城订单（30分钟未付款自动清除，取消后不影响重新下单） */
  async autoCancelExpiredPendingOrdersCron(): Promise<{ cancelled: number }> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 60 * 1000);
    let cancelled = 0;

    try {
      const expired = await this.db
        .select()
        .from(mallOrders)
        .where(
          and(
            eq(mallOrders.status, MALL_ORDER_STATUS.PENDING_PAYMENT),
            sql`${mallOrders.createdAt} <= ${cutoff}`,
          ),
        );

      if (expired.length > 0) {
        this.logger.log(`定时任务扫描到 ${expired.length} 个超时(30分钟)未付款商城订单，自动取消`);
      }

      for (const order of expired) {
        try {
          await this.db
            .update(mallOrders)
            .set({
              status: MALL_ORDER_STATUS.CANCELLED,
              cancelledAt: now,
              cancelReason: '下单后30分钟内未完成付款，系统自动取消，您可重新下单购买',
            })
            .where(eq(mallOrders.id, order.id));
          cancelled++;
        } catch (e) {
          this.logger.error(`定时任务自动取消未付款商城订单失败: orderId=${order.id}, error=${e}`);
        }
      }

      if (cancelled > 0) {
        this.logger.log(`定时任务完成: 自动取消超时未付款商城订单${cancelled}个`);
      }
    } catch (e) {
      this.logger.error(`定时任务扫描超时未付款商城订单失败: ${e}`);
    }

    return { cancelled };
  }

  /** 获取订单对应的收款码（根据订单sellerId判断显示卖家收款码还是平台收款码） */
  async getOrderQrcode(userId: string, orderId: string): Promise<{
    wechatQrcodeUrl?: string;
    alipayQrcodeUrl?: string;
  }> {
    const orderList = await this.db
      .select()
      .from(mallOrders)
      .where(eq(mallOrders.id, orderId))
      .limit(1);

    const order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('无权查看该订单');
    }

    const sellerId = (order as any).sellerId;

    // 如果订单有卖家，获取卖家的收款码
    if (sellerId) {
      const sellerList = await this.db
        .select()
        .from(users)
        .where(eq(users.id, sellerId))
        .limit(1);
      const seller = sellerList[0];
      if (seller) {
        return {
          wechatQrcodeUrl: (seller as any).wechatQrcodeUrl ?? undefined,
          alipayQrcodeUrl: (seller as any).alipayQrcodeUrl ?? undefined,
        };
      }
    }

    // 没有卖家，返回平台收款码
    const platformQrList = await this.db
      .select()
      .from(platformQrcodes)
      .where(eq(platformQrcodes.type, 'mall_platform'))
      .limit(1);

    if (platformQrList.length === 0) {
      return {};
    }

    const qr = platformQrList[0];
    return {
      wechatQrcodeUrl: qr.wechatQrcodeUrl ?? undefined,
      alipayQrcodeUrl: qr.alipayQrcodeUrl ?? undefined,
    };
  }
}
