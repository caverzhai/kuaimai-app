import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, count, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { consultOrders, users, teamRelations } from '@server/database/schema';
import { generateOrderNo } from '@server/common/utils/auth.util';
import {
  CONSULT_ORDER_STATUS,
  LEVEL_LAYERS,
  LEVELS,
} from '@shared/api.interface';
import type {
  ConsultOrderInfo,
  CreateConsultOrderDTO,
  ConsultOrderListResponse,
  PaymentScreenshotDTO,
  WorkScreenshotDTO,
  ReviewDTO,
  UserInfo,
} from '@shared/api.interface';
import { UpgradeService } from '../upgrade/upgrade.service';

@Injectable()
export class ConsultOrdersService {
  private readonly logger = new Logger(ConsultOrdersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly upgradeService: UpgradeService,
  ) {}

  private toOrderInfo(
    order: typeof consultOrders.$inferSelect,
  ): ConsultOrderInfo {
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
      workSubmittedAt: order.workSubmittedAt
        ? order.workSubmittedAt.toISOString()
        : undefined,
      workReviewedAt: order.workReviewedAt
        ? order.workReviewedAt.toISOString()
        : undefined,
      reviewRemark: order.reviewRemark ?? undefined,
      isOverflow: order.isOverflow,
      overflowToGroup: order.overflowToGroup,
      autoConfirmDeadline: order.autoConfirmDeadline
        ? order.autoConfirmDeadline.toISOString()
        : undefined,
      createdAt: order.createdAt.toISOString(),
    };
  }

  private toUserBrief(user: typeof users.$inferSelect): UserInfo {
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

  /**
   * 计算学员和咨询师之间的层级距离
   * 从学员的 team_relations 记录出发，沿 path 向上回溯
   * 直推下级 = 第1层，下下级 = 第2层 ...
   * 如果咨询师不在学员祖先路径上，返回 null
   */
  async getDistanceBetween(
    studentId: string,
    consultantId: string,
  ): Promise<number | null> {
    const relationList = await this.db
      .select()
      .from(teamRelations)
      .where(eq(teamRelations.userId, studentId));

    const relation = relationList[0];
    if (!relation) {
      return null;
    }

    const ancestors: string[] = relation.path
      .split(',')
      .filter((s: string) => s.length > 0);

    const index = ancestors.indexOf(consultantId);
    if (index === -1) {
      return null;
    }

    return index + 1;
  }

  async create(
    studentId: string,
    isInvited: boolean,
    dto: CreateConsultOrderDTO,
  ): Promise<ConsultOrderInfo> {
    // 校验咨询师存在且 level != junior（管理员除外）
    const consultantList = await this.db
      .select()
      .from(users)
      .where(eq(users.id, dto.consultantId));

    const consultant = consultantList[0];
    if (!consultant) {
      throw new NotFoundException('咨询师不存在');
    }
    // 管理员（零号线）可以作为咨询师，即使是初级
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    if (consultant.level === LEVELS.JUNIOR && consultant.id !== ADMIN_ID) {
      throw new BadRequestException('初级用户不能提供咨询服务');
    }

    // 计算层级距离
    const distance = await this.getDistanceBetween(
      studentId,
      dto.consultantId,
    );

    let isOverflow = false;
    let overflowToGroup = false;

    if (distance !== null) {
      const maxLayers = LEVEL_LAYERS[consultant.level] ?? 0;
      if (distance > maxLayers) {
        isOverflow = true;
        overflowToGroup = true;
      }
    }
    // 如果学员不在咨询师团队树下（distance === null），就是普通购买，不算超层

    const orderNo = generateOrderNo('C');
    const amountStr = dto.amount.toFixed(2);

    const inserted = await this.db
      .insert(consultOrders)
      .values({
        orderNo,
        studentId,
        consultantId: dto.consultantId,
        serviceType: dto.serviceType,
        amount: amountStr,
        taskLevelFrom: dto.taskLevelFrom,
        taskLevelTo: dto.taskLevelTo,
        taskIndex: dto.taskIndex,
        status: CONSULT_ORDER_STATUS.PENDING_PAYMENT,
        isOverflow,
        overflowToGroup,
      })
      .returning();

    this.logger.log(
      `创建咨询订单: orderNo=${orderNo}, studentId=${studentId}, ` +
        `consultantId=${dto.consultantId}, distance=${distance}, ` +
        `isOverflow=${isOverflow}`,
    );

    return this.toOrderInfo(inserted[0]);
  }

  /**
   * 自动确认超时的订单（20分钟未审核自动确认）
   * 在查询订单时调用，确保超时订单被自动处理
   */
  private async autoConfirmExpiredOrders(orders: Array<typeof consultOrders.$inferSelect>): Promise<void> {
    const now = new Date();
    for (const order of orders) {
      // 只处理待确认状态且有自动确认截止时间的订单
      if (
        order.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM &&
        order.autoConfirmDeadline &&
        new Date(order.autoConfirmDeadline) <= now
      ) {
        try {
          this.logger.log(`自动确认超时订单: orderId=${order.id}, consultantId=${order.consultantId}`);
          // 直接调用confirmPayment，使用咨询师的ID
          await this.confirmPayment(order.consultantId, order.id);
        } catch (e) {
          this.logger.error(`自动确认订单失败: orderId=${order.id}, error=${e}`);
        }
      }
    }
  }

  async getStudentOrders(
    studentId: string,
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<ConsultOrderListResponse> {
    const conditions = [eq(consultOrders.studentId, studentId)];
    if (status) {
      conditions.push(eq(consultOrders.status, status));
    }

    const whereClause = and(...conditions);

    const [countResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(consultOrders)
        .where(whereClause),
      this.db
        .select()
        .from(consultOrders)
        .where(whereClause)
        .orderBy(desc(consultOrders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const now = new Date();

    // 自动确认超时的订单（20分钟未审核）
    await this.autoConfirmExpiredOrders(items);

    // 如果有自动确认的订单，重新查询
    const hasExpired = items.some(
      (item) =>
        item.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM &&
        item.autoConfirmDeadline &&
        new Date(item.autoConfirmDeadline) <= now,
    );
    let finalItems = items;
    if (hasExpired) {
      finalItems = await this.db
        .select()
        .from(consultOrders)
        .where(whereClause)
        .orderBy(desc(consultOrders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    }

    // 关联查咨询师信息（inArray + Map 分组回填，避免 N+1）
    const consultantIds = finalItems.map(
      (item: typeof consultOrders.$inferSelect) => item.consultantId,
    );
    const consultantMap = new Map<string, UserInfo>();

    if (consultantIds.length > 0) {
      const uniqueIds = [...new Set(consultantIds)];
      const consultants = await this.db
        .select()
        .from(users)
        .where(inArray(users.id, uniqueIds));

      for (const c of consultants) {
        consultantMap.set(c.id, this.toUserBrief(c));
      }
    }

    const orderItems: ConsultOrderInfo[] = finalItems.map(
      (item: typeof consultOrders.$inferSelect) => {
        const info = this.toOrderInfo(item);
        const consultant = consultantMap.get(item.consultantId);
        if (consultant) {
          info.consultant = consultant;
        }
        return info;
      },
    );

    return {
      items: orderItems,
      total,
      page,
      pageSize,
    };
  }

  async getConsultantOrders(
    consultantId: string,
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<ConsultOrderListResponse> {
    const conditions = [eq(consultOrders.consultantId, consultantId)];
    if (status) {
      // 支持逗号分隔的多状态筛选，如 "pending_confirm,pending_review"
      const statusList = status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statusList.length === 1) {
        conditions.push(eq(consultOrders.status, statusList[0]));
      } else if (statusList.length > 1) {
        conditions.push(inArray(consultOrders.status, statusList));
      }
    }

    const whereClause = and(...conditions);

    const [countResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(consultOrders)
        .where(whereClause),
      this.db
        .select()
        .from(consultOrders)
        .where(whereClause)
        .orderBy(desc(consultOrders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const now = new Date();

    // 自动确认超时的订单（20分钟未审核）
    await this.autoConfirmExpiredOrders(items);

    // 如果有自动确认的订单，重新查询
    const hasExpired = items.some(
      (item) =>
        item.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM &&
        item.autoConfirmDeadline &&
        new Date(item.autoConfirmDeadline) <= now,
    );
    let finalItems = items;
    if (hasExpired) {
      finalItems = await this.db
        .select()
        .from(consultOrders)
        .where(whereClause)
        .orderBy(desc(consultOrders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    }

    // 关联查学员信息（inArray + Map 分组回填，避免 N+1）
    const studentIds = finalItems.map(
      (item: typeof consultOrders.$inferSelect) => item.studentId,
    );
    const studentMap = new Map<string, UserInfo>();

    if (studentIds.length > 0) {
      const uniqueIds = [...new Set(studentIds)];
      const students = await this.db
        .select()
        .from(users)
        .where(inArray(users.id, uniqueIds));

      for (const s of students) {
        studentMap.set(s.id, this.toUserBrief(s));
      }
    }

    const orderItems: ConsultOrderInfo[] = finalItems.map(
      (item: typeof consultOrders.$inferSelect) => {
        const info = this.toOrderInfo(item);
        const student = studentMap.get(item.studentId);
        if (student) {
          info.student = student;
        }
        return info;
      },
    );

    return {
      items: orderItems,
      total,
      page,
      pageSize,
    };
  }

  async getOrderDetail(
    userId: string,
    id: string,
  ): Promise<ConsultOrderInfo> {
    const orderList = await this.db
      .select()
      .from(consultOrders)
      .where(eq(consultOrders.id, id));

    let order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 自动确认超时的订单（20分钟未审核）
    const now = new Date();
    if (
      order.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM &&
      order.autoConfirmDeadline &&
      new Date(order.autoConfirmDeadline) <= now
    ) {
      try {
        await this.confirmPayment(order.consultantId, order.id);
        // 重新查询订单
        const refreshed = await this.db.select().from(consultOrders).where(eq(consultOrders.id, id));
        if (refreshed[0]) {
          order = refreshed[0] as any;
        }
      } catch (e) {
        this.logger.error(`自动确认订单失败: orderId=${id}, error=${e}`);
      }
    }

    // 验证订单属于当前用户（学员或咨询师任一方）
    if (order.studentId !== userId && order.consultantId !== userId) {
      throw new ForbiddenException('无权查看该订单');
    }

    const result = this.toOrderInfo(order);

    // 加载对方基本信息
    const otherUserId =
      order.studentId === userId ? order.consultantId : order.studentId;

    const otherUserList = await this.db
      .select()
      .from(users)
      .where(eq(users.id, otherUserId));

    if (otherUserList[0]) {
      const otherUser = this.toUserBrief(otherUserList[0]);
      if (order.studentId === userId) {
        result.consultant = otherUser;
      } else {
        result.student = otherUser;
      }
    }

    return result;
  }

  async uploadPaymentScreenshot(
    userId: string,
    id: string,
    dto: PaymentScreenshotDTO,
  ): Promise<ConsultOrderInfo> {
    const orderList = await this.db
      .select()
      .from(consultOrders)
      .where(eq(consultOrders.id, id));

    let order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.studentId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (order.status !== CONSULT_ORDER_STATUS.PENDING_PAYMENT) {
      throw new BadRequestException('当前订单状态不允许上传付款凭证');
    }

    const autoConfirmDeadline = new Date();
    autoConfirmDeadline.setMinutes(autoConfirmDeadline.getMinutes() + 20);

    const updated = await this.db
      .update(consultOrders)
      .set({
        paymentScreenshotUrl: dto.screenshotUrl,
        status: CONSULT_ORDER_STATUS.PENDING_CONFIRM,
        autoConfirmDeadline,
      })
      .where(eq(consultOrders.id, id))
      .returning();

    this.logger.log(
      `咨询订单付款凭证已上传: orderId=${id}, ` +
        `status=${CONSULT_ORDER_STATUS.PENDING_CONFIRM}`,
    );

    return this.toOrderInfo(updated[0]);
  }

  async confirmPayment(
    userId: string,
    id: string,
  ): Promise<ConsultOrderInfo> {
    const orderList = await this.db
      .select()
      .from(consultOrders)
      .where(eq(consultOrders.id, id));

    let order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 检查是否是管理员（管理员可以审核所有订单）
    const userList = await this.db.select().from(users).where(eq(users.id, userId));
    const currentUser = userList[0];
    const isAdmin = currentUser?.phone === '13800000000';

    if (!isAdmin && order.consultantId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (order.status !== CONSULT_ORDER_STATUS.PENDING_CONFIRM) {
      throw new BadRequestException('当前订单状态不允许确认收款');
    }

    const now = new Date();

    // 使用事务：更新订单状态为已完成 + 累加收入 + 检查900门槛
    const updatedOrders = await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(consultOrders)
        .set({
          status: CONSULT_ORDER_STATUS.COMPLETED,
          paymentConfirmedAt: now,
          workReviewedAt: now,
        })
        .where(eq(consultOrders.id, id))
        .returning();

      // 超层流失订单，咨询师不拿收入（归咨询师团）
      if (!order.isOverflow || !order.overflowToGroup) {
        const orderAmount = String(order.amount);

        // 累加咨询师 totalConsultIncome
        const updatedUsers = await tx
          .update(users)
          .set({
            totalConsultIncome: sql`${users.totalConsultIncome} + ${orderAmount}::numeric`,
          })
          .where(eq(users.id, userId))
          .returning();

        const consultant = updatedUsers[0];
        if (consultant && consultant.level === LEVELS.LEVEL_4) {
          // 900元门槛检查：仅针对 level_4 咨询师
          const incomeNum = Number(consultant.totalConsultIncome);
          if (
            incomeNum > 900 &&
            consultant.directInviteCount < 3 &&
            !consultant.thresholdBlocked
          ) {
            await tx
              .update(users)
              .set({
                thresholdBlocked: true,
                thresholdTriggeredAt: now,
              })
              .where(eq(users.id, userId));

            this.logger.log(
              `4级咨询师触发900元门槛: consultantId=${userId}, ` +
                `totalConsultIncome=${incomeNum}, ` +
                `directInviteCount=${consultant.directInviteCount}`,
            );
          }
        }
      }

      return updated;
    });

    this.logger.log(
      `咨询订单确认收款并完成: orderId=${id}, ` +
        `status=${CONSULT_ORDER_STATUS.COMPLETED}, ` +
        `isOverflow=${order.isOverflow}`,
    );

    // 确认收款后立即触发升级任务完成检查（取消作业提交流程）
    try {
      await this.upgradeService.checkConsultTaskComplete(
        order.studentId,
        order.id,
        order.consultantId,
        String(order.amount),
      );
    } catch (e) {
      this.logger.error(`确认收款后触发升级任务完成失败: ${e}`);
    }

    return this.toOrderInfo(updatedOrders[0]);
  }

  async uploadWork(
    userId: string,
    id: string,
    dto: WorkScreenshotDTO,
  ): Promise<ConsultOrderInfo> {
    const orderList = await this.db
      .select()
      .from(consultOrders)
      .where(eq(consultOrders.id, id));

    let order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.studentId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (order.status !== CONSULT_ORDER_STATUS.IN_SERVICE) {
      throw new BadRequestException('当前订单状态不允许提交作业');
    }

    const now = new Date();
    const autoConfirmDeadline = new Date();
    autoConfirmDeadline.setMinutes(autoConfirmDeadline.getMinutes() + 20);

    const updated = await this.db
      .update(consultOrders)
      .set({
        workScreenshotUrl: dto.screenshotUrl,
        workSubmittedAt: now,
        status: CONSULT_ORDER_STATUS.PENDING_REVIEW,
        autoConfirmDeadline,
      })
      .where(eq(consultOrders.id, id))
      .returning();

    this.logger.log(
      `咨询订单作业已提交: orderId=${id}, ` +
        `status=${CONSULT_ORDER_STATUS.PENDING_REVIEW}`,
    );

    return this.toOrderInfo(updated[0]);
  }

  async reviewWork(
    userId: string,
    id: string,
    dto: ReviewDTO,
  ): Promise<ConsultOrderInfo> {
    const orderList = await this.db
      .select()
      .from(consultOrders)
      .where(eq(consultOrders.id, id));

    let order = orderList[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 检查是否是管理员（管理员可以审核所有订单）
    const userList = await this.db.select().from(users).where(eq(users.id, userId));
    const currentUser = userList[0];
    const isAdmin = currentUser?.phone === '13800000000';

    if (!isAdmin && order.consultantId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (order.status !== CONSULT_ORDER_STATUS.PENDING_REVIEW) {
      throw new BadRequestException('当前订单状态不允许审核作业');
    }

    const now = new Date();

    if (dto.passed) {
      const updated = await this.db
        .update(consultOrders)
        .set({
          status: CONSULT_ORDER_STATUS.COMPLETED,
          workReviewedAt: now,
          reviewRemark: dto.remark,
        })
        .where(eq(consultOrders.id, id))
        .returning();

      this.logger.log(`咨询订单作业审核通过: orderId=${id}`);

      // 触发升级任务完成检查
      try {
        await this.upgradeService.checkConsultTaskComplete(
          order.studentId,
          order.id,
          order.consultantId,
          String(order.amount),
        );
      } catch (e) {
        this.logger.error(`触发升级任务完成失败: ${e}`);
      }

      return this.toOrderInfo(updated[0]);
    } else {
      const updated = await this.db
        .update(consultOrders)
        .set({
          status: CONSULT_ORDER_STATUS.IN_SERVICE,
          reviewRemark: dto.remark,
        })
        .where(eq(consultOrders.id, id))
        .returning();

      this.logger.log(`咨询订单作业驳回重交: orderId=${id}`);
      return this.toOrderInfo(updated[0]);
    }
  }
}
