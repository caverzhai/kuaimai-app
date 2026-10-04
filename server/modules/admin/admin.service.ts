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
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';

import {
  users,
  products,
  mallOrders,
  consultOrders,
  platformQrcodes,
  upgradeTasks,
  managementFees,
  teamRelations,
  platformCollectionRecords,
} from '@server/database/schema';
import { ProductsService } from '@server/modules/products/products.service';
import { hashPassword, generateOrderNo } from '@server/common/utils/auth.util';
import { UpgradeService } from '@server/modules/upgrade/upgrade.service';
import {
  LEVELS,
  PRODUCT_STATUS,
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
  sellerId?: string;
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
  sellerId?: string;
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
  permanentLossAmount: string; // 永久流失（级别不够）
  assessmentStatus: string; // 四星考核状态
  fourStarAt?: string;
  platformCollectedAmount: string; // 平台累计代收（可返回流失）
  refundRate?: number;
  refundedAmount: string;
  refundStatus: string;
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

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    return this.productsService.deleteProduct(id);
  }

  /** 管理员重置用户密码（用户忘记密码、无短信验证码时的兜底方案） */
  async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean }> {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('新密码长度至少6位');
    }
    const existing = await this.db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (existing.length === 0) {
      throw new NotFoundException('用户不存在');
    }
    const trimmed = String(newPassword).trim();
    const hashed = await hashPassword(trimmed);
    await this.db.update(users).set({ password: hashed }).where(eq(users.id, id));
    this.logger.log('管理员重置用户密码: id=' + id + ', phone=' + existing[0].phone);
    return { success: true };
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

    // 平台后台只显示平台自营订单（sellerId 为空）；卖家商品订单由卖家在自己后台处理
    const conditions = [sql`${mallOrders.sellerId} IS NULL`];
    if (params.status) conditions.push(eq(mallOrders.status, params.status));
    const whereClause = and(...conditions);

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

  // 临时：补完成指定用户的商城购买任务（用于修复自动确认未触发任务完成的历史订单）
  async fixUserMallTask(userId: string): Promise<{ fixed: boolean; taskId?: string; nextTaskId?: string; upgraded?: boolean }> {
    const tasks = await this.db
      .select()
      .from(upgradeTasks)
      .where(and(
        eq(upgradeTasks.userId, userId),
        eq(upgradeTasks.taskType, 'mall_purchase'),
        or(eq(upgradeTasks.status, TASK_STATUS.IN_PROGRESS), eq(upgradeTasks.status, TASK_STATUS.PENDING)),
      ))
      .orderBy(upgradeTasks.taskIndex)
      .limit(1);

    if (tasks.length === 0) return { fixed: false };

    const task = tasks[0];
    const now = new Date();
    await this.db.update(upgradeTasks).set({
      status: TASK_STATUS.COMPLETED,
      completedAt: now,
      mallOrderId: null,
    }).where(eq(upgradeTasks.id, task.id));

    // 自动开始下一个任务
    let nextTaskId;
    const nextTasks = await this.db.select().from(upgradeTasks).where(and(
      eq(upgradeTasks.userId, userId),
      eq(upgradeTasks.fromLevel, task.fromLevel),
      eq(upgradeTasks.toLevel, task.toLevel),
      eq(upgradeTasks.taskIndex, task.taskIndex + 1),
    )).limit(1);
    if (nextTasks.length > 0 && nextTasks[0].status === TASK_STATUS.PENDING) {
      await this.db.update(upgradeTasks).set({
        status: TASK_STATUS.IN_PROGRESS,
      }).where(eq(upgradeTasks.id, nextTasks[0].id));
      nextTaskId = nextTasks[0].id;
    }

    // 检查是否全部完成，是则升级
    let upgraded = false;
    const allTasks = await this.db.select({ status: upgradeTasks.status }).from(upgradeTasks).where(and(
      eq(upgradeTasks.userId, userId),
      eq(upgradeTasks.fromLevel, task.fromLevel),
      eq(upgradeTasks.toLevel, task.toLevel),
    ));
    if (allTasks.length > 0 && allTasks.every(t => t.status === TASK_STATUS.COMPLETED)) {
      await this.db.update(users).set({ level: task.toLevel, updatedAt: now }).where(eq(users.id, userId));
      upgraded = true;
    }

    this.logger.log(`补完成商城任务: userId=${userId}, taskId=${task.id}, nextTask=${nextTaskId || "none"}, upgraded=${upgraded}`);
    return { fixed: true, taskId: task.id, nextTaskId, upgraded };
  }

  // 清理初级用户的团队树位置（新规则：初级用户不占团队树位置，完成4级任务后才滑落）
  async cleanJuniorTeamPositions(): Promise<{ cleaned: number; users: Array<{ id: string; nickname: string; phone: string }> }> {
    // 查找所有 level = junior 的用户，在代码中过滤 parentId 不为 null 的
    const allJunior = await this.db
      .select({
        id: users.id,
        nickname: users.nickname,
        phone: users.phone,
        parentId: users.parentId,
      })
      .from(users)
      .where(eq(users.level, 'junior'));
    const juniorInTeam = allJunior.filter(u => u.parentId !== null);

    if (juniorInTeam.length === 0) {
      return { cleaned: 0, users: [] };
    }

    // 逐个删除和更新（避免复杂的SQL数组语法）
    for (const junior of juniorInTeam) {
      await this.db.delete(teamRelations).where(eq(teamRelations.userId, junior.id));
      await this.db.update(users).set({ parentId: null, treeLevel: 0 }).where(eq(users.id, junior.id));
    }
    this.logger.log(`清理了 ${juniorInTeam.length} 个初级用户的团队树位置: ${juniorInTeam.map(u => u.nickname).join(', ')}`);

    return { cleaned: juniorInTeam.length, users: juniorInTeam };
  }

  /**
   * BFS 团队树滑落（事务内）：从邀请人开始，逐层找第一个直接下级不足 3 人的节点。
   * 与 UsersService.findParentForSliding 同逻辑，供管理员手动放位复用。
   */
  private async findPlacementForTx(
    tx: PostgresJsDatabase,
    inviterId: string,
  ): Promise<{ parentId: string; parentRelation: typeof teamRelations.$inferSelect | null }> {
    const queue: string[] = [inviterId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = await tx
        .select()
        .from(teamRelations)
        .where(eq(teamRelations.parentId, currentId));

      if (children.length < 3) {
        const relationRows = await tx
          .select()
          .from(teamRelations)
          .where(eq(teamRelations.userId, currentId))
          .limit(1);
        return { parentId: currentId, parentRelation: relationRows[0] ?? null };
      }

      const sortedChildren = [...children].sort((a, b) => a.position - b.position);
      for (const c of sortedChildren) queue.push(c.userId);
    }
    return { parentId: inviterId, parentRelation: null };
  }

  /**
   * 手动修复某用户的 4 级升级（新规则：首次商城付款即"待位"进树）：
   * 1) 团队树无记录则按 BFS 滑落插入（用户 level 仍为 junior => 待位）；
   * 2) 校正 4 级全部任务收款人（直推=邀请人；上级/上上级/上上上级按待位 path）；
   * 3) taskIndex < completeBeforeIndex 的任务手动置完成（缺咨询单则补一条 completed）；
   * 4) taskIndex == completeBeforeIndex 的任务置 in_progress，留给用户本人完成。
   * 全部 5 任务完成、level 升到 level_4 即"正式"。错付资金由平台线下核对处理。
   */
  async fixUserLevel4Placement(
    userId: string,
    completeBeforeIndex = 4,
  ): Promise<{
    userId: string;
    parentId: string | null;
    treeLevel: number;
    path: string;
    report: Array<{ taskIndex: number; title: string; action: string; targetId: string | null }>;
  }> {
    const now = new Date();
    const userRows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user) throw new NotFoundException('用户不存在');
    const inviterId = user.inviterId;
    if (!inviterId) throw new BadRequestException('该用户无邀请人，无法确定团队位置');

    return await this.db.transaction(async (tx) => {
      // 1) 团队树无记录则 BFS 滑落插入（待位）
      const existRows = await tx
        .select()
        .from(teamRelations)
        .where(eq(teamRelations.userId, userId))
        .limit(1);
      let relation: typeof teamRelations.$inferSelect;

      if (existRows.length === 0) {
        const placement = await this.findPlacementForTx(tx, inviterId);
        const treeLevel = placement.parentRelation ? placement.parentRelation.treeLevel + 1 : 1;
        const basePath = placement.parentRelation ? placement.parentRelation.path : ',' + inviterId + ',';
        const path = basePath + userId + ',';
        const childCountRows = await tx
          .select({ c: sql<number>`count(*)` })
          .from(teamRelations)
          .where(eq(teamRelations.parentId, placement.parentId));
        const position = Number(childCountRows[0]?.c ?? 0);
        const inserted = await tx
          .insert(teamRelations)
          .values({ userId, parentId: placement.parentId, inviterId, treeLevel, path, position })
          .returning();
        relation = inserted[0];
        await tx.update(users).set({ parentId: placement.parentId, treeLevel }).where(eq(users.id, userId));
        const ancestorIds = path.split(',').filter((s) => s.length > 0 && s !== userId);
        if (ancestorIds.length > 0) {
          await tx
            .update(users)
            .set({ teamTotalCount: sql`${users.teamTotalCount} + 1` })
            .where(
              sql`${users.id} = ANY(ARRAY[${sql.join(
                ancestorIds.map((id) => sql`${id}::uuid`),
                sql`, `,
              )}]::uuid[])`,
            );
        }
      } else {
        relation = existRows[0];
      }

      const path = relation.path;
      const ancestorAt = (depth: number): string | null => {
        const segs = path.split(',').filter((s) => s.length > 0);
        const idx = segs.length - depth - 1;
        return idx >= 0 ? segs[idx] ?? null : null;
      };

      // 2) 取该用户升 4 级的全部任务，按 taskIndex
      const taskRows = await tx
        .select()
        .from(upgradeTasks)
        .where(and(eq(upgradeTasks.userId, userId), eq(upgradeTasks.toLevel, LEVELS.LEVEL_4)));
      taskRows.sort((a, b) => a.taskIndex - b.taskIndex);

      const report: Array<{ taskIndex: number; title: string; action: string; targetId: string | null }> = [];

      for (const t of taskRows) {
        // 校正收款人：task1=直推(邀请人)；task2/3/4=待位 path 上 depth 1/2/3 的上级
        let targetId: string | null = t.targetId ?? null;
        if (t.taskType === 'consult_service') {
          if (t.taskIndex === 1) targetId = inviterId;
          else if (t.taskIndex >= 2) targetId = ancestorAt(t.taskIndex - 1);
        }

        if (t.taskIndex < completeBeforeIndex) {
          // 3) 手动完成
          await tx
            .update(upgradeTasks)
            .set({ status: TASK_STATUS.COMPLETED, completedAt: now, targetId })
            .where(eq(upgradeTasks.id, t.id));

          if (t.taskType === 'consult_service' && targetId) {
            let linked = await tx.select().from(consultOrders).where(eq(consultOrders.taskId, t.id));
            if (linked.length === 0) {
              linked = await tx.select().from(consultOrders).where(and(
                eq(consultOrders.studentId, userId),
                eq(consultOrders.taskIndex, t.taskIndex),
                eq(consultOrders.taskLevelTo, t.toLevel),
              ));
            }
            if (linked.length === 0) {
              // 缺订单则补一条 completed（资金平台线下核对）
              let orderNo = generateOrderNo('C');
              for (let i = 0; i < 5; i++) {
                const dup = await tx
                  .select({ id: consultOrders.id })
                  .from(consultOrders)
                  .where(eq(consultOrders.orderNo, orderNo))
                  .limit(1);
                if (dup.length === 0) break;
                orderNo = generateOrderNo('C');
              }
              await tx.insert(consultOrders).values({
                orderNo,
                studentId: userId,
                consultantId: targetId,
                serviceType: 'upgrade_task',
                amount: String(t.amount),
                taskLevelFrom: t.fromLevel,
                taskLevelTo: t.toLevel,
                taskIndex: t.taskIndex,
                taskId: t.id,
                status: CONSULT_ORDER_STATUS.COMPLETED,
                paymentConfirmedAt: now,
                workReviewedAt: now,
              });
            } else {
              await tx
                .update(consultOrders)
                .set({
                  status: CONSULT_ORDER_STATUS.COMPLETED,
                  paymentConfirmedAt: linked[0].paymentConfirmedAt ?? now,
                  workReviewedAt: now,
                })
                .where(eq(consultOrders.id, linked[0].id));
            }
          }
          report.push({ taskIndex: t.taskIndex, title: t.title, action: 'completed', targetId });
        } else if (t.taskIndex === completeBeforeIndex) {
          // 4) 待做任务置 in_progress、校正收款人
          await tx
            .update(upgradeTasks)
            .set({ status: TASK_STATUS.IN_PROGRESS, targetId })
            .where(eq(upgradeTasks.id, t.id));
          report.push({ taskIndex: t.taskIndex, title: t.title, action: 'in_progress', targetId });
        } else {
          if (targetId !== t.targetId) {
            await tx.update(upgradeTasks).set({ targetId }).where(eq(upgradeTasks.id, t.id));
          }
          report.push({ taskIndex: t.taskIndex, title: t.title, action: t.status, targetId });
        }
      }

      return { userId, parentId: relation.parentId, treeLevel: relation.treeLevel, path, report };
    });
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
      autoDeliveryDeadline.setSeconds(autoDeliveryDeadline.getSeconds() + 180);
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

  /** 批量实时有效直推人数 */
  private async effectiveDirectMap(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};
    const rows = await this.db
      .select({ inviterId: users.inviterId, n: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(teamRelations, eq(teamRelations.userId, users.id))
      .where(
        and(
          inArray(users.inviterId, ids),
          sql`${users.level} <> 'junior' AND ${users.assessmentStatus} IS DISTINCT FROM 'eliminated'`,
        ),
      )
      .groupBy(users.inviterId);
    const map: Record<string, number> = {};
    for (const r of rows) map[r.inviterId] = r.n;
    return map;
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
    const items = itemsRaw.map((item) => this.toUserInfo(item));
    const edm = await this.effectiveDirectMap(items.map((i) => i.id));
    for (const it of items) it.directInviteCount = edm[it.id] ?? 0;
    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async getUserDetail(id: string): Promise<UserInfo> {
    const userRows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (userRows.length === 0) throw new NotFoundException('用户不存在');
    const info = this.toUserInfo(userRows[0]);
    info.directInviteCount = (await this.effectiveDirectMap([id]))[id] ?? 0;
    return info;
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
      permanentLossAmount: String((user as any).permanentLossAmount ?? '0'),
      assessmentStatus: user.assessmentStatus ?? 'none',
      fourStarAt: user.fourStarAt ? user.fourStarAt.toISOString() : undefined,
      platformCollectedAmount: String(user.platformCollectedAmount ?? '0'),
      refundRate: user.refundRate ?? undefined,
      refundedAmount: String(user.refundedAmount ?? '0'),
      refundStatus: user.refundStatus ?? 'none',
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

  // ==================== 推广费（管理费）审核 ====================

  /** 管理员查看所有推广费记录 */
  async getAllManagementFees(page: number, pageSize: number, status?: string) {
    const conditions: any[] = [];
    if (status) conditions.push(eq(managementFees.status, status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = this.db.select().from(managementFees);
    const [countResult, items] = await Promise.all([
      this.db.select({ count: count() }).from(managementFees).where(whereClause as any),
      baseQuery
        .where(whereClause as any)
        .orderBy(desc(managementFees.feeDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return {
      items: items.map((row: any) => ({
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
      })),
      total: Number(countResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  /** 管理员确认推广费已到账 */
  async confirmManagementFee(adminId: string, feeId: string) {
    const rows = await this.db.select().from(managementFees).where(eq(managementFees.id, feeId)).limit(1);
    const fee = rows[0];
    if (!fee) throw new NotFoundException('推广费记录不存在');
    if (fee.status !== 'pending_review') {
      throw new BadRequestException('当前状态不允许确认，需卖家先上传支付凭证');
    }
    const updated = await this.db
      .update(managementFees)
      .set({ status: 'confirmed', confirmedBy: adminId, confirmedAt: new Date() })
      .where(eq(managementFees.id, feeId))
      .returning();
    await this.restoreFeeProducts(fee);
    this.logger.log(`管理员确认推广费: feeId=${feeId}, sellerId=${fee.sellerId}`);
    return { success: true, id: updated[0].id, status: updated[0].status };
  }

  /**
   * 管理员确认推广费后，自动上架因欠费下架的商品
   * 优先按记录的商品ID精确恢复；历史无记录时兜底恢复该卖家所有仓库商品
   */
  private async restoreFeeProducts(fee: { sellerId: string; warehousedProductIds?: string | null }) {
    let ids: string[] = [];
    if (fee.warehousedProductIds) {
      try {
        const parsed = JSON.parse(fee.warehousedProductIds);
        if (Array.isArray(parsed)) ids = parsed.filter((x) => typeof x === 'string');
      } catch {
        ids = [];
      }
    }

    let restored = 0;
    if (ids.length > 0) {
      for (const pid of ids) {
        const r = await this.db
          .update(products)
          .set({ status: PRODUCT_STATUS.ON_SALE })
          .where(and(eq(products.id, pid), eq(products.status, PRODUCT_STATUS.WAREHOUSE)))
          .returning({ id: products.id });
        restored += r.length;
      }
    } else {
      const r = await this.db
        .update(products)
        .set({ status: PRODUCT_STATUS.ON_SALE })
        .where(and(eq(products.sellerId, fee.sellerId), eq(products.status, PRODUCT_STATUS.WAREHOUSE)))
        .returning({ id: products.id });
      restored = r.length;
    }
    if (restored > 0) {
      this.logger.log(`管理员确认推广费，自动上架商品: sellerId=${fee.sellerId}, 上架数=${restored}`);
    }
    return restored;
  }


  /**
   * 获取四星考核返还打款申请列表（达标即自动生成，无需用户申请）：
   * pending=待平台打款 / confirmed=已打款
   * 每条申请附带用户本人收款二维码，平台直接扫码支付给用户
   */
  async getRefundList() {
    const rows = await this.db
      .select({
        id: users.id,
        phone: users.phone,
        nickname: users.nickname,
        realName: users.realName,
        level: users.level,
        assessmentStatus: users.assessmentStatus,
        platformCollectedAmount: users.platformCollectedAmount,
        refundRate: users.refundRate,
        refundedAmount: users.refundedAmount,
        refundStatus: users.refundStatus,
        wechatQrcodeUrl: users.wechatQrcodeUrl,
        alipayQrcodeUrl: users.alipayQrcodeUrl,
        companyQrcodeUrl: users.companyQrcodeUrl,
      })
      .from(users)
      .where(inArray(users.refundStatus, ['pending', 'confirmed']));

    const result: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const records = await this.db
        .select({
          id: platformCollectionRecords.id,
          amount: platformCollectionRecords.amount,
          refundStatus: platformCollectionRecords.refundStatus,
          createdAt: platformCollectionRecords.createdAt,
        })
        .from(platformCollectionRecords)
        .where(eq(platformCollectionRecords.consultantId, r.id));
      result.push({
        ...r,
        platformCollectedAmount: String(r.platformCollectedAmount ?? '0'),
        refundedAmount: String(r.refundedAmount ?? '0'),
        records: records.map((x) => ({
          id: x.id,
          amount: String(x.amount),
          refundStatus: x.refundStatus,
          createdAt: x.createdAt.toISOString(),
        })),
      });
    }
    return result;
  }

  /** 管理员确认四星返还已线下打款：refundStatus pending→confirmed，代收明细置 refunded */
  async confirmRefundPayment(adminId: string, userId: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = rows[0];
    if (!u) throw new NotFoundException('用户不存在');
    if (u.refundStatus !== 'pending') {
      throw new BadRequestException('当前状态不允许确认，需考核达标且存在待打款返还');
    }
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ refundStatus: 'confirmed' }).where(eq(users.id, userId));
      await tx
        .update(platformCollectionRecords)
        .set({ refundStatus: 'refunded' })
        .where(eq(platformCollectionRecords.consultantId, userId));
    });
    this.logger.log(`管理员确认四星返还打款: userId=${userId}, adminId=${adminId}`);
    return { success: true, userId, refundStatus: 'confirmed' };
  }
}
