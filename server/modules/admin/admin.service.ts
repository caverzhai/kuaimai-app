import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

import {
  users,
  mallOrders,
  consultOrders,
  platformQrcodes,
  upgradeTasks,
} from '@server/database/schema';
import { ProductsService } from '@server/modules/products/products.service';
import { UpgradeService } from '@server/modules/upgrade/upgrade.service';
import {
  LEVELS,
  MALL_ORDER_STATUS,
  CONSULT_ORDER_STATUS,
  TASK_STATUS,
} from '@shared/api.interface';
import type {
  ProductInfo,
  ProductListResponse,
  MallOrderInfo,
  MallOrderListResponse,
  ConsultOrderInfo,
  ConsultOrderListResponse,
  UserInfo,
  PlatformQrcodeInfo,
  ReviewDTO,
  ShipDTO,
} from '@shared/api.interface';

interface AdminListParams {
  page?: number;
  pageSize?: number;
}

interface ProductListParams extends AdminListParams {
  category?: string;
  keyword?: string;
  status?: string;
}

interface CreateProductDTO {
  name: string;
  price: string;
  description?: string;
  category?: string;
  spec?: string;
  mainImages: { url: string }[];
  detailImages: { url: string }[];
  sortOrder?: number;
}

interface UpdateProductDTO {
  name?: string;
  price?: string;
  description?: string;
  category?: string;
  spec?: string;
  mainImages?: { url: string }[];
  detailImages?: { url: string }[];
  status?: string;
  sortOrder?: number;
}

interface MallOrderListParams extends AdminListParams {
  status?: string;
}

interface UserListParams extends AdminListParams {
  level?: string;
  keyword?: string;
}

interface QrcodeUpdateDTO {
  wechatQrcodeUrl?: string;
  alipayQrcodeUrl?: string;
}

interface FinanceInfo {
  totalConsultIncome: string;
  pendingReclaimAmount: string;
  overflowLossAmount: string;
  thresholdBlocked: boolean;
  thresholdTriggeredAt?: string;
  directInviteCount: number;
  wechatQrcodeUrl?: string;
  alipayQrcodeUrl?: string;
  companyQrcodeUrl?: string;
  level: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly productsService: ProductsService,
    private readonly upgradeService: UpgradeService,
  ) {}

  // ============================================================
  // 鍟嗗搧绠＄悊
  // ============================================================

  async getProductList(params: ProductListParams): Promise<ProductListResponse> {
    return this.productsService.getAdminProductList(params);
  }

  async createProduct(dto: CreateProductDTO): Promise<ProductInfo> {
    return this.productsService.createProduct(dto);
  }

  async updateProduct(id: string, dto: UpdateProductDTO): Promise<ProductInfo> {
    return this.productsService.updateProduct(id, dto);
  }

  async toggleProductStatus(id: string): Promise<ProductInfo> {
    const detail = await this.productsService.getProductDetail(id);
    const nextStatus = detail.status === 'on_sale' ? 'off_shelf' : 'on_sale';
    return this.productsService.updateProductStatus(id, nextStatus);
  }

  // ============================================================
  // 鍟嗗煄璁㈠崟绠＄悊
  // ============================================================

  private toMallOrderInfo(order: typeof mallOrders.$inferSelect): MallOrderInfo {
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

  async getMallOrderList(params: MallOrderListParams): Promise<MallOrderListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (params.status) conditions.push(eq(mallOrders.status, params.status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(mallOrders).where(whereClause),
      this.db
        .select()
        .from(mallOrders)
        .where(whereClause)
        .orderBy(desc(mallOrders.createdAt))
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

  async reviewMallOrderPayment(id: string, dto: ReviewDTO): Promise<MallOrderInfo> {
    const orderRows = await this.db.select().from(mallOrders).where(eq(mallOrders.id, id)).limit(1);
    const order = orderRows[0];
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== MALL_ORDER_STATUS.PENDING_REVIEW) {
      throw new BadRequestException('当前订单状态不允许审核');
    }

    if (!dto.passed) {
      // 审核不通过，回到待付款
      const updated = await this.db
        .update(mallOrders)
        .set({
          status: MALL_ORDER_STATUS.PENDING_PAYMENT,
          paymentScreenshotUrl: null,
          autoConfirmDeadline: null,
        })
        .where(eq(mallOrders.id, id))
        .returning();
      this.logger.log(`商城订单审核不通过: orderId=${id}`);
      return this.toMallOrderInfo(updated[0]);
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

    this.logger.log(`商城订单审核通过: orderId=${id}`);

    // 审核收款通过后，自动完成用户的商城购买升级任务（0号任务）
    try {
      await this.upgradeService.checkMallTaskComplete(
        order.userId,
        id,
        order.totalAmount,
      );
      this.logger.log(`已检查并完成商城购买升级任务: userId=${order.userId}, orderId=${id}`);
    } catch (taskError) {
      this.logger.error(`完成商城购买升级任务失败: ${taskError.message}`);
    }

    return this.toMallOrderInfo(updated[0]);
  }

  async shipMallOrder(id: string, dto: ShipDTO): Promise<MallOrderInfo> {
    const orderRows = await this.db.select().from(mallOrders).where(eq(mallOrders.id, id)).limit(1);
    const order = orderRows[0];
    if (!order) throw new NotFoundException('订单不存在');
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
      .where(eq(mallOrders.id, id))
      .returning();

    this.logger.log(`鍟嗗煄璁㈠崟鍙戣揣: orderId=${id}, 鏃犻渶鐗╂祦=${isNoLogistics}`);
    return this.toMallOrderInfo(updated[0]);
  }

  async cancelMallOrder(id: string): Promise<MallOrderInfo> {
    const orderRows = await this.db.select().from(mallOrders).where(eq(mallOrders.id, id)).limit(1);
    const order = orderRows[0];
    if (!order) throw new NotFoundException('订单不存在');
    if (
      order.status === MALL_ORDER_STATUS.COMPLETED ||
      order.status === MALL_ORDER_STATUS.CANCELLED
    ) {
      throw new BadRequestException('当前订单状态不允许取消');
    }

    const now = new Date();
    const updated = await this.db
      .update(mallOrders)
      .set({
        status: MALL_ORDER_STATUS.CANCELLED,
        cancelledAt: now,
        cancelReason: '鍚庡彴鍙栨秷',
      })
      .where(eq(mallOrders.id, id))
      .returning();

    this.logger.log(`鍚庡彴鍙栨秷鍟嗗煄璁㈠崟: orderId=${id}`);
    return this.toMallOrderInfo(updated[0]);
  }

  // ============================================================
  // 鐢ㄦ埛绠＄悊
  // ============================================================

  private toUserInfo(user: typeof users.$inferSelect): UserInfo {
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

  async getUserList(params: UserListParams): Promise<{
    items: UserInfo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (params.level) conditions.push(eq(users.level, params.level));
    if (params.keyword) {
      conditions.push(
        or(
          ilike(users.nickname, `%${params.keyword}%`),
          ilike(users.phone, `%${params.keyword}%`),
        ),
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(users).where(whereClause),
      this.db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
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

  async getUserDetail(id: string): Promise<UserInfo> {
    const userRows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (userRows.length === 0) throw new NotFoundException('用户不存在');
    return this.toUserInfo(userRows[0]);
  }

  // 修改用户手机号
  async updateUserPhone(id: string, newPhone: string): Promise<UserInfo> {
    // 验证手机号格式
    if (!/^1\d{10}$/.test(newPhone)) {
      throw new BadRequestException('手机号格式不正确，必须是11位数字');
    }
    const existing = await this.db.select().from(users).where(eq(users.phone, newPhone)).limit(1);
    if (existing.length > 0 && existing[0].id !== id) {
      throw new ConflictException('该手机号已被其他用户使用');
    }
    const userRows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (userRows.length === 0) throw new NotFoundException('用户不存在');

    const updated = await this.db
      .update(users)
      .set({ phone: newPhone })
      .where(eq(users.id, id))
      .returning();
    this.logger.log(`管理员修改用户手机号: userId=${id}, oldPhone=${userRows[0].phone}, newPhone=${newPhone}`);
    return this.toUserInfo(updated[0]);
  }

  // 公司资质审核

  async getCompanyAuditList(params: AdminListParams): Promise<{
    items: UserInfo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const whereClause = eq(users.companyAuditStatus, 'pending');

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(users).where(whereClause),
      this.db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
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

  async reviewCompanyAudit(id: string, dto: ReviewDTO): Promise<UserInfo> {
    const userRows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = userRows[0];
    if (!user) throw new NotFoundException('用户不存在');
    if (user.companyAuditStatus !== 'pending') {
      throw new BadRequestException('当前状态不允许审核');
    }

    const newStatus = dto.passed ? 'approved' : 'rejected';

    if (dto.passed && user.level === LEVELS.LEVEL_7) {
      // 审核通过的7级用户，检查是否满足升级条件（最后一个任务完成）
      const lastTaskRows = await this.db
        .select()
        .from(upgradeTasks)
        .where(
          and(
            eq(upgradeTasks.toLevel, LEVELS.LEVEL_7),
          ),
        )
        .orderBy(desc(upgradeTasks.taskIndex))
        .limit(1);

      const lastTask = lastTaskRows[0];
      if (lastTask && lastTask.status === TASK_STATUS.COMPLETED) {
        // 鎵ц鍗囩骇鍒?level_8
        const updated = await this.db
          .update(users)
          .set({
            companyAuditStatus: newStatus,
            level: LEVELS.LEVEL_8,
          })
          .where(eq(users.id, id))
          .returning();
        this.logger.log(`鍏徃璧勮川瀹℃牳閫氳繃骞跺崌绾? userId=${id}, level=${LEVELS.LEVEL_8}`);
        return this.toUserInfo(updated[0]);
      }
    }

    const updated = await this.db
      .update(users)
      .set({ companyAuditStatus: newStatus })
      .where(eq(users.id, id))
      .returning();

    this.logger.log(`鍏徃璧勮川瀹℃牳: userId=${id}, passed=${dto.passed}`);
    return this.toUserInfo(updated[0]);
  }

  // ============================================================
  // 骞冲彴鏀舵鐮佺鐞?  // ============================================================

  async getPlatformQrcode(type: string): Promise<PlatformQrcodeInfo> {
    const rows = await this.db
      .select()
      .from(platformQrcodes)
      .where(eq(platformQrcodes.type, type))
      .limit(1);

    if (rows.length === 0) {
      // 不存在则返回空对象，由前端判断
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

  async updatePlatformQrcode(type: string, dto: QrcodeUpdateDTO): Promise<PlatformQrcodeInfo> {
    const existing = await this.db
      .select({ id: platformQrcodes.id })
      .from(platformQrcodes)
      .where(eq(platformQrcodes.type, type))
      .limit(1);

    if (existing.length === 0) {
      // type 不存在则创建
      const inserted = await this.db
        .insert(platformQrcodes)
        .values({
          type,
          wechatQrcodeUrl: dto.wechatQrcodeUrl ?? null,
          alipayQrcodeUrl: dto.alipayQrcodeUrl ?? null,
        })
        .returning();
      const qr = inserted[0];
      this.logger.log(`鍒涘缓骞冲彴鏀舵鐮? type=${type}`);
      return {
        id: qr.id,
        type: qr.type,
        wechatQrcodeUrl: qr.wechatQrcodeUrl ?? undefined,
        alipayQrcodeUrl: qr.alipayQrcodeUrl ?? undefined,
      };
    }

    const patch: Partial<typeof platformQrcodes.$inferInsert> = {};
    if (dto.wechatQrcodeUrl !== undefined) patch.wechatQrcodeUrl = dto.wechatQrcodeUrl;
    if (dto.alipayQrcodeUrl !== undefined) patch.alipayQrcodeUrl = dto.alipayQrcodeUrl;

    if (Object.keys(patch).length === 0) {
      return this.getPlatformQrcode(type);
    }

    const updated = await this.db
      .update(platformQrcodes)
      .set(patch)
      .where(eq(platformQrcodes.type, type))
      .returning();

    const qr = updated[0];
    this.logger.log(`鏇存柊骞冲彴鏀舵鐮? type=${type}`);
    return {
      id: qr.id,
      type: qr.type,
      wechatQrcodeUrl: qr.wechatQrcodeUrl ?? undefined,
      alipayQrcodeUrl: qr.alipayQrcodeUrl ?? undefined,
    };
  }

  // ============================================================
  // 鍜ㄨ璁㈠崟绠＄悊
  // ============================================================

  private toConsultOrderInfo(order: typeof consultOrders.$inferSelect): ConsultOrderInfo {
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

  async getConsultOrderList(params: MallOrderListParams): Promise<ConsultOrderListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (params.status) conditions.push(eq(consultOrders.status, params.status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(consultOrders).where(whereClause),
      this.db
        .select()
        .from(consultOrders)
        .where(whereClause)
        .orderBy(desc(consultOrders.createdAt))
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

  // ============================================================
  // 资金概览（用户端）

  async getFinanceInfo(userId: string): Promise<FinanceInfo> {
    const userRows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) throw new NotFoundException('用户不存在');
    const user = userRows[0];

    // 计算累计咨询收入（状态为已完成的咨询订单，咨询师为当前用户）
    const incomeRows = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${consultOrders.amount}), '0')`,
      })
      .from(consultOrders)
      .where(
        and(
          eq(consultOrders.consultantId, userId),
          eq(consultOrders.status, CONSULT_ORDER_STATUS.COMPLETED),
        ),
      );

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
}
