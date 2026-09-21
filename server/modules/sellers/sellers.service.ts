import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, gte, lt, inArray, count, sql } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import { products, mallOrders, managementFees, users } from '../../database/schema';
import {
  PRODUCT_STATUS,
  MALL_ORDER_STATUS,
  MANAGEMENT_FEE_STATUS,
  SELLER_STATUS,
} from '../../../shared/api.interface';

/** 管理费率：0.8% */
const MANAGEMENT_FEE_RATE = 0.008;

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: any) {}

  /** 断言用户是已通过审核的商家 */
  async assertApprovedSeller(userId: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (!user.isSeller || user.sellerStatus !== SELLER_STATUS.APPROVED) {
      throw new ForbiddenException('您不是已通过审核的商家');
    }
    return user;
  }

  /** 北京时间当前日期 */
  private beijingNow() {
    const bj = new Date(Date.now() + 8 * 3600 * 1000);
    return {
      year: bj.getUTCFullYear(),
      month0: bj.getUTCMonth(),
      date: bj.getUTCDate(),
    };
  }

  /** 北京时间零点（UTC） */
  private bjMidnight(year: number, month0: number, date: number) {
    return new Date(Date.UTC(year, month0, date, 0, 0, 0) - 8 * 3600 * 1000);
  }

  /** 转换商品信息 */
  private toProductInfo(row: any) {
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

  /** 转换订单信息 */
  private toOrderInfo(order: any) {
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
      paymentConfirmedAt: order.paymentConfirmedAt ? order.paymentConfirmedAt.toISOString() : undefined,
      logisticsCompany: order.logisticsCompany ?? undefined,
      logisticsNo: order.logisticsNo ?? undefined,
      shippedAt: order.shippedAt ? order.shippedAt.toISOString() : undefined,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : undefined,
      cancelReason: order.cancelReason ?? undefined,
      cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : undefined,
      autoConfirmDeadline: order.autoConfirmDeadline ? order.autoConfirmDeadline.toISOString() : undefined,
      autoDeliveryDeadline: order.autoDeliveryDeadline ? order.autoDeliveryDeadline.toISOString() : undefined,
      createdAt: order.createdAt.toISOString(),
    };
  }

  /** 转换管理费信息 */
  private toFeeInfo(row: any) {
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

  // ==================== 商品管理 ====================

  /** 获取商家商品列表 */
  async getSellerProducts(sellerId: string, page: number, pageSize: number, status?: string) {
    await this.assertApprovedSeller(sellerId);
    const conditions: any[] = [eq(products.sellerId, sellerId)];
    if (status) conditions.push(eq(products.status, status));
    const whereClause = and(...conditions);

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(products).where(whereClause),
      this.db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(desc(products.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return {
      items: itemsRaw.map((item: any) => this.toProductInfo(item)),
      total,
      page,
      pageSize,
    };
  }

  /** 商家创建商品（直接上架，无需审核） */
  async createSellerProduct(sellerId: string, dto: any) {
    const seller = await this.assertApprovedSeller(sellerId);
    const inserted = await this.db
      .insert(products)
      .values({
        name: dto.name,
        price: dto.price,
        description: dto.description ?? null,
        category: dto.category ?? null,
        spec: dto.spec ?? null,
        mainImages: dto.mainImages,
        detailImages: dto.detailImages,
        status: PRODUCT_STATUS.ON_SALE, // 商家商品直接上架，无需总后台审核
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

  /** 商家编辑商品 */
  async updateSellerProduct(sellerId: string, productId: string, dto: any) {
    await this.assertApprovedSeller(sellerId);
    const rows = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
    const product = rows[0];
    if (!product) throw new NotFoundException('商品不存在');
    if (product.sellerId !== sellerId) throw new ForbiddenException('无权编辑该商品');

    const patch: any = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.price !== undefined) patch.price = dto.price;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.spec !== undefined) patch.spec = dto.spec;
    if (dto.mainImages !== undefined) patch.mainImages = dto.mainImages;
    if (dto.detailImages !== undefined) patch.detailImages = dto.detailImages;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.sellerWechatQrcodeUrl !== undefined) patch.sellerWechatQrcodeUrl = dto.sellerWechatQrcodeUrl;
    if (dto.sellerAlipayQrcodeUrl !== undefined) patch.sellerAlipayQrcodeUrl = dto.sellerAlipayQrcodeUrl;

    if (Object.keys(patch).length === 0) {
      return this.toProductInfo(product);
    }

    const updated = await this.db
      .update(products)
      .set(patch)
      .where(eq(products.id, productId))
      .returning();

    this.logger.log(`商家编辑商品: sellerId=${sellerId}, productId=${productId}`);
    return this.toProductInfo(updated[0]);
  }

  /** 商家上下架商品 */
  async toggleSellerProductStatus(sellerId: string, productId: string) {
    await this.assertApprovedSeller(sellerId);
    const rows = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
    const product = rows[0];
    if (!product) throw new NotFoundException('商品不存在');
    if (product.sellerId !== sellerId) throw new ForbiddenException('无权操作该商品');

    if (product.status === PRODUCT_STATUS.WAREHOUSE) {
      throw new BadRequestException('违规下架商品不可自行恢复，请联系管理员');
    }

    const nextStatus = product.status === PRODUCT_STATUS.ON_SALE
      ? PRODUCT_STATUS.OFF_SHELF
      : PRODUCT_STATUS.ON_SALE;

    const updated = await this.db
      .update(products)
      .set({ status: nextStatus })
      .where(eq(products.id, productId))
      .returning();

    this.logger.log(`商家上下架商品: sellerId=${sellerId}, productId=${productId}, status=${nextStatus}`);
    return this.toProductInfo(updated[0]);
  }

  // ==================== 订单管理 ====================

  /** 获取商家订单列表 */
  async getSellerOrders(sellerId: string, page: number, pageSize: number, status?: string) {
    await this.assertApprovedSeller(sellerId);
    const conditions: any[] = [eq(mallOrders.sellerId, sellerId)];
    if (status) conditions.push(eq(mallOrders.status, status));
    const whereClause = and(...conditions);

    const [countResult, items] = await Promise.all([
      this.db.select({ count: count() }).from(mallOrders).where(whereClause),
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
      items: items.map((item: any) => this.toOrderInfo(item)),
      total,
      page,
      pageSize,
    };
  }

  /** 商家发货 */
  async sellerShipOrder(sellerId: string, orderId: string, dto: any) {
    await this.assertApprovedSeller(sellerId);
    const orderList = await this.db.select().from(mallOrders).where(eq(mallOrders.id, orderId));
    const order = orderList[0];
    if (!order) throw new NotFoundException('订单不存在');
    if (order.sellerId !== sellerId) throw new ForbiddenException('无权操作该订单');
    if (order.status !== MALL_ORDER_STATUS.PENDING_SHIPMENT) {
      throw new BadRequestException('当前订单状态不允许发货');
    }

    const isNoLogistics = dto.logisticsCompany === '无需物流';
    if (!isNoLogistics) {
      if (!dto.logisticsCompany || !dto.logisticsNo) {
        throw new BadRequestException('物流公司和物流单号不能为空');
      }
    }

    const now = new Date();
    const autoDeliveryDeadline = new Date(now);
    if (isNoLogistics) {
      autoDeliveryDeadline.setMinutes(autoDeliveryDeadline.getMinutes() + 20);
    } else {
      autoDeliveryDeadline.setDate(autoDeliveryDeadline.getDate() + 15);
    }

    const updated = await this.db
      .update(mallOrders)
      .set({
        status: MALL_ORDER_STATUS.PENDING_DELIVERY,
        logisticsCompany: dto.logisticsCompany,
        logisticsNo: isNoLogistics ? null : dto.logisticsNo,
        shippedAt: now,
        autoDeliveryDeadline,
      })
      .where(eq(mallOrders.id, orderId))
      .returning();

    this.logger.log(`商家发货: sellerId=${sellerId}, orderId=${orderId}`);
    return this.toOrderInfo(updated[0]);
  }

  // ==================== 管理费（佣金）管理 ====================

  /** 获取商家管理费列表 */
  async getSellerManagementFees(sellerId: string, page: number, pageSize: number, status?: string) {
    await this.assertApprovedSeller(sellerId);
    const conditions: any[] = [eq(managementFees.sellerId, sellerId)];
    if (status) conditions.push(eq(managementFees.status, status));
    const whereClause = and(...conditions);

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(managementFees).where(whereClause),
      this.db
        .select()
        .from(managementFees)
        .where(whereClause)
        .orderBy(desc(managementFees.feeDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return {
      items: itemsRaw.map((item: any) => this.toFeeInfo(item)),
      total,
      page,
      pageSize,
    };
  }

  /** 商家支付管理费（上传支付凭证） */
  async payManagementFee(sellerId: string, feeId: string, screenshotUrl: string) {
    await this.assertApprovedSeller(sellerId);
    if (!screenshotUrl) {
      throw new BadRequestException('支付凭证不能为空');
    }

    const rows = await this.db.select().from(managementFees).where(eq(managementFees.id, feeId)).limit(1);
    const fee = rows[0];
    if (!fee) throw new NotFoundException('管理费记录不存在');
    if (fee.sellerId !== sellerId) throw new ForbiddenException('无权操作该管理费');
    if (fee.status !== MANAGEMENT_FEE_STATUS.PENDING) {
      throw new BadRequestException('当前管理费状态不允许支付');
    }

    const updated = await this.db
      .update(managementFees)
      .set({
        status: MANAGEMENT_FEE_STATUS.PAID,
        paymentScreenshotUrl: screenshotUrl,
        paidAt: new Date(),
      })
      .where(eq(managementFees.id, feeId))
      .returning();

    this.logger.log(`商家支付管理费: sellerId=${sellerId}, feeId=${feeId}`);
    return this.toFeeInfo(updated[0]);
  }

  /**
   * 生成昨日所有商家的管理费（0.8%佣金）
   * 每日零点后调用，生成昨日全天商品成交额 * 0.8% 的管理费
   */
  async generateDailyManagementFees() {
    const { year, month0, date } = this.beijingNow();
    const todayStart = this.bjMidnight(year, month0, date);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);
    const feeDate = yesterdayStart;

    this.logger.log(`开始生成昨日管理费: feeDate=${feeDate.toISOString()}, 费率=${MANAGEMENT_FEE_RATE * 100}%`);

    const soldStatuses = [
      MALL_ORDER_STATUS.PENDING_SHIPMENT,
      MALL_ORDER_STATUS.PENDING_DELIVERY,
      MALL_ORDER_STATUS.COMPLETED,
    ];

    // 查询昨日有成交的商家及其成交额
    const sellerSales = await this.db
      .select({
        sellerId: mallOrders.sellerId,
        sellerName: mallOrders.sellerName,
        totalSales: sql`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
      })
      .from(mallOrders)
      .where(
        and(
          gte(mallOrders.paymentConfirmedAt, yesterdayStart),
          lt(mallOrders.paymentConfirmedAt, todayStart),
          inArray(mallOrders.status, soldStatuses),
        ),
      )
      .groupBy(mallOrders.sellerId, mallOrders.sellerName);

    let generatedCount = 0;
    for (const sale of sellerSales) {
      if (!sale.sellerId) continue;
      const totalSales = Number(sale.totalSales ?? 0);
      if (totalSales <= 0) continue;

      const feeAmount = Math.round(totalSales * MANAGEMENT_FEE_RATE * 100) / 100;

      // 检查是否已生成
      const existing = await this.db
        .select({ count: count() })
        .from(managementFees)
        .where(
          and(
            eq(managementFees.sellerId, sale.sellerId),
            eq(managementFees.feeDate, feeDate),
          ),
        );

      if (Number(existing[0]?.count ?? 0) > 0) {
        this.logger.log(`管理费已存在，跳过: sellerId=${sale.sellerId}, feeDate=${feeDate.toISOString()}`);
        continue;
      }

      // 截止时间：当日12点（北京时间）
      const deadline = new Date(todayStart.getTime() + 12 * 3600 * 1000);

      await this.db.insert(managementFees).values({
        sellerId: sale.sellerId,
        sellerName: sale.sellerName ?? null,
        feeDate,
        totalSales,
        feeAmount,
        status: MANAGEMENT_FEE_STATUS.PENDING,
        deadline,
      });

      generatedCount++;
      this.logger.log(`生成管理费: sellerId=${sale.sellerId}, totalSales=${totalSales}, feeAmount=${feeAmount}`);
    }

    this.logger.log(`昨日管理费生成完成，共生成 ${generatedCount} 条`);
    return { generatedCount, feeDate: feeDate.toISOString() };
  }

  /**
   * 检查超时未支付管理费的商家，将其商品下架（仓库状态）
   * 每日12点后调用
   */
  async autoWarehouseOverdueFees() {
    const now = new Date();

    // 查询所有已过截止时间且仍为待支付的管理费
    const overdueFees = await this.db
      .select()
      .from(managementFees)
      .where(
        and(
          eq(managementFees.status, MANAGEMENT_FEE_STATUS.PENDING),
          lt(managementFees.deadline, now),
        ),
      );

    let warehouseCount = 0;
    for (const fee of overdueFees) {
      // 将该商家的所有在售商品改为仓库状态
      const updated = await this.db
        .update(products)
        .set({ status: PRODUCT_STATUS.WAREHOUSE })
        .where(
          and(
            eq(products.sellerId, fee.sellerId),
            eq(products.status, PRODUCT_STATUS.ON_SALE),
          ),
        )
        .returning();

      warehouseCount += updated.length;
      this.logger.log(`超时未付管理费，商品下架: sellerId=${fee.sellerId}, 下架商品数=${updated.length}`);
    }

    this.logger.log(`超时管理费检查完成，共下架 ${warehouseCount} 个商品`);
    return { warehouseCount };
  }

  // ==================== 统计 ====================

  /** 获取商家统计数据 */
  async getSellerStats(sellerId: string) {
    await this.assertApprovedSeller(sellerId);
    const { year, month0, date } = this.beijingNow();
    const todayStart = this.bjMidnight(year, month0, date);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);

    const soldStatuses = [
      MALL_ORDER_STATUS.PENDING_SHIPMENT,
      MALL_ORDER_STATUS.PENDING_DELIVERY,
      MALL_ORDER_STATUS.COMPLETED,
    ];

    const [totalProductsRow, onSaleRow, todaySalesRow, todayOrdersRow, pendingFeeRow, totalSalesRow] =
      await Promise.all([
        this.db.select({ count: count() }).from(products).where(eq(products.sellerId, sellerId)),
        this.db
          .select({ count: count() })
          .from(products)
          .where(and(eq(products.sellerId, sellerId), eq(products.status, PRODUCT_STATUS.ON_SALE))),
        this.db
          .select({ total: sql`COALESCE(SUM(${mallOrders.totalAmount}), '0')` })
          .from(mallOrders)
          .where(
            and(
              eq(mallOrders.sellerId, sellerId),
              gte(mallOrders.paymentConfirmedAt, todayStart),
              lt(mallOrders.paymentConfirmedAt, tomorrowStart),
              inArray(mallOrders.status, soldStatuses),
            ),
          ),
        this.db
          .select({ count: count() })
          .from(mallOrders)
          .where(
            and(
              eq(mallOrders.sellerId, sellerId),
              gte(mallOrders.paymentConfirmedAt, todayStart),
              lt(mallOrders.paymentConfirmedAt, tomorrowStart),
              inArray(mallOrders.status, soldStatuses),
            ),
          ),
        this.db
          .select({
            total: sql`COALESCE(SUM(${managementFees.feeAmount}), '0')`,
            count: count(),
          })
          .from(managementFees)
          .where(
            and(
              eq(managementFees.sellerId, sellerId),
              eq(managementFees.status, MANAGEMENT_FEE_STATUS.PENDING),
            ),
          ),
        this.db
          .select({ total: sql`COALESCE(SUM(${mallOrders.totalAmount}), '0')` })
          .from(mallOrders)
          .where(and(eq(mallOrders.sellerId, sellerId), inArray(mallOrders.status, soldStatuses))),
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

  // ==================== 商家申请 ====================

  /** 申请成为商家 */
  async applySeller(userId: string, dto: any) {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) throw new NotFoundException('用户不存在');

    if (user.isSeller && user.sellerStatus === SELLER_STATUS.APPROVED) {
      return { success: true, sellerStatus: SELLER_STATUS.APPROVED };
    }
    if (user.isSeller && user.sellerStatus === SELLER_STATUS.PENDING) {
      return { success: true, sellerStatus: SELLER_STATUS.PENDING };
    }

    const patch: any = {
      isSeller: true,
      sellerStatus: SELLER_STATUS.PENDING,
    };
    if (dto.realName) patch.realName = dto.realName;
    if (dto.wechatId) patch.wechatId = dto.wechatId;
    if (dto.businessLicenseUrl) patch.businessLicenseUrl = dto.businessLicenseUrl;

    await this.db.update(users).set(patch).where(eq(users.id, userId));
    this.logger.log(`申请成为商家: userId=${userId}, realName=${dto.realName ?? ''}`);
    return { success: true, sellerStatus: SELLER_STATUS.PENDING };
  }
}
