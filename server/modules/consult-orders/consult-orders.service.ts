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


      taskId: order.taskId ?? undefined,


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

   * 璁＄畻瀛﹀憳鍜屽挩璇㈠笀涔嬮棿鐨勫眰绾ц窛绂?
   * 浠庡鍛樼殑 team_relations 璁板綍鍑哄彂锛屾部 path 鍚戜笂鍥炴函

   * 鐩存帹涓嬬骇 = 绗?灞傦紝涓嬩笅绾?= 绗?灞?...

   * 濡傛灉鍜ㄨ甯堜笉鍦ㄥ鍛樼鍏堣矾寰勪笂锛岃繑鍥?null

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


    // 鏍￠獙鍜ㄨ甯堝瓨鍦ㄤ笖 level != junior锛堢鐞嗗憳闄ゅ锛?

    const consultantList = await this.db


      .select()


      .from(users)


      .where(eq(users.id, dto.consultantId));




    const consultant = consultantList[0];


    if (!consultant) {


      throw new NotFoundException('鍜ㄨ甯堜笉瀛樺湪');


    }


    // 绠＄悊鍛橈紙闆跺彿绾匡級鍙互浣滀负鍜ㄨ甯堬紝鍗充娇鏄垵绾?

    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';


    if (consultant.level === LEVELS.JUNIOR && consultant.id !== ADMIN_ID) {


      throw new BadRequestException('初级用户不能提供咨询服务');


    }




    // 璁＄畻灞傜骇璺濈


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


    // 濡傛灉瀛﹀憳涓嶅湪鍜ㄨ甯堝洟闃熸爲涓嬶紙distance === null锛夛紝灏辨槸鏅€氳喘涔帮紝涓嶇畻瓒呭眰




    // 幂等性检查：如果同一个任务已经有pending_payment或pending_confirm状态的订单，返回已存在的订单
    if (dto.taskId) {
      const existingOrders = await this.db
        .select()
        .from(consultOrders)
        .where(and(
          eq(consultOrders.studentId, studentId),
          eq(consultOrders.taskId, dto.taskId),
          inArray(consultOrders.status, [
            CONSULT_ORDER_STATUS.PENDING_PAYMENT,
            CONSULT_ORDER_STATUS.PENDING_CONFIRM,
            CONSULT_ORDER_STATUS.IN_SERVICE,
            CONSULT_ORDER_STATUS.PENDING_REVIEW,
          ]),
        ));
      if (existingOrders.length > 0) {
        this.logger.log(
          `幂等性检查：任务 ${dto.taskId} 已有进行中的订单，返回已存在的订单`,
        );
        return this.toOrderInfo(existingOrders[0]);
      }
    }

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


        taskId: dto.taskId,


        status: CONSULT_ORDER_STATUS.PENDING_PAYMENT,


        isOverflow,


        overflowToGroup,


      })


      .returning();




    this.logger.log(


      `鍒涘缓鍜ㄨ璁㈠崟: orderNo=${orderNo}, studentId=${studentId}, ` +


        `consultantId=${dto.consultantId}, distance=${distance}, ` +


        `isOverflow=${isOverflow}`,


    );




    return this.toOrderInfo(inserted[0]);

  }



  /**

   * 鑷姩纭瓒呮椂鐨勮鍗曪紙20鍒嗛挓鏈鏍歌嚜鍔ㄧ‘璁わ級

   * 鍦ㄦ煡璇㈣鍗曟椂璋冪敤锛岀‘淇濊秴鏃惰鍗曡鑷姩澶勭悊

   */

  private async autoConfirmExpiredOrders(orders: Array<typeof consultOrders.$inferSelect>): Promise<void> {


    const now = new Date();


    for (const order of orders) {


      // 鍙鐞嗗緟纭鐘舵€佷笖鏈夎嚜鍔ㄧ‘璁ゆ埅姝㈡椂闂寸殑璁㈠崟


      if (


        order.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM &&


        order.autoConfirmDeadline &&


        new Date(order.autoConfirmDeadline) <= now


      ) {


        try {


          this.logger.log(`鑷姩纭瓒呮椂璁㈠崟: orderId=${order.id}, consultantId=${order.consultantId}`);


          // 鐩存帴璋冪敤confirmPayment锛屼娇鐢ㄥ挩璇㈠笀鐨処D


          await this.confirmPayment(order.consultantId, order.id);


        } catch (e) {


          this.logger.error(`鑷姩纭璁㈠崟澶辫触: orderId=${order.id}, error=${e}`);


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


      // 支持逗号分隔的多个状态查询
      const statusList = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length > 1) {
        conditions.push(inArray(consultOrders.status, statusList));
      } else {
        conditions.push(eq(consultOrders.status, status));
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




    // 鑷姩纭瓒呮椂鐨勮鍗曪紙20鍒嗛挓鏈鏍革級


    await this.autoConfirmExpiredOrders(items);




    // 濡傛灉鏈夎嚜鍔ㄧ‘璁ょ殑璁㈠崟锛岄噸鏂版煡璇?

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




    // 鍏宠仈鏌ュ挩璇㈠笀淇℃伅锛坕nArray + Map 鍒嗙粍鍥炲～锛岄伩鍏?N+1锛?

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


      // 鏀寔閫楀彿鍒嗛殧鐨勫鐘舵€佺瓫閫夛紝濡?"pending_confirm,pending_review"


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




    // 鑷姩纭瓒呮椂鐨勮鍗曪紙20鍒嗛挓鏈鏍革級


    await this.autoConfirmExpiredOrders(items);




    // 濡傛灉鏈夎嚜鍔ㄧ‘璁ょ殑璁㈠崟锛岄噸鏂版煡璇?

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




    // 鍏宠仈鏌ュ鍛樹俊鎭紙inArray + Map 鍒嗙粍鍥炲～锛岄伩鍏?N+1锛?

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




    // 鑷姩纭瓒呮椂鐨勮鍗曪紙20鍒嗛挓鏈鏍革級


    const now = new Date();


    if (


      order.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM &&


      order.autoConfirmDeadline &&


      new Date(order.autoConfirmDeadline) <= now


    ) {


      try {


        await this.confirmPayment(order.consultantId, order.id);


        // 閲嶆柊鏌ヨ璁㈠崟


        const refreshed = await this.db.select().from(consultOrders).where(eq(consultOrders.id, id));


        if (refreshed[0]) {


          order = refreshed[0] as any;


        }


      } catch (e) {


        this.logger.error(`鑷姩纭璁㈠崟澶辫触: orderId=${id}, error=${e}`);


      }


    }




    // 楠岃瘉璁㈠崟灞炰簬褰撳墠鐢ㄦ埛锛堝鍛樻垨鍜ㄨ甯堜换涓€鏂癸級


    if (order.studentId !== userId && order.consultantId !== userId) {


      throw new ForbiddenException('无权查看该订单');


    }




    const result = this.toOrderInfo(order);




    // 鍔犺浇瀵规柟鍩烘湰淇℃伅


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


      throw new BadRequestException('当前订单状态不允许操作');


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


      `鍜ㄨ璁㈠崟浠樻鍑瘉宸蹭笂浼? orderId=${id}, ` +


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




    // 妫€鏌ユ槸鍚︽槸绠＄悊鍛橈紙绠＄悊鍛樺彲浠ュ鏍告墍鏈夎鍗曪級


    const userList = await this.db.select().from(users).where(eq(users.id, userId));


    const currentUser = userList[0];


    const isAdmin = currentUser?.phone === '13800000000';




    if (!isAdmin && order.consultantId !== userId) {


      throw new ForbiddenException('无权操作该订单');


    }


    if (order.status !== CONSULT_ORDER_STATUS.PENDING_CONFIRM) {


      throw new BadRequestException('当前订单状态不允许操作');


    }




    const now = new Date();




    // 浣跨敤浜嬪姟锛氭洿鏂拌鍗曠姸鎬佷负宸插畬鎴?+ 绱姞鏀跺叆 + 妫€鏌?00闂ㄦ


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




      // 瓒呭眰娴佸け璁㈠崟锛屽挩璇㈠笀涓嶆嬁鏀跺叆锛堝綊鍜ㄨ甯堝洟锛?

      if (!order.isOverflow || !order.overflowToGroup) {


        const orderAmount = String(order.amount);




        // 绱姞鍜ㄨ甯?totalConsultIncome


        const updatedUsers = await tx


          .update(users)


          .set({


            totalConsultIncome: sql`${users.totalConsultIncome} + ${orderAmount}::numeric`,


          })


          .where(eq(users.id, userId))


          .returning();




        const consultant = updatedUsers[0];


        if (consultant && consultant.level === LEVELS.LEVEL_4) {


          // 900鍏冮棬妲涙鏌ワ細浠呴拡瀵?level_4 鍜ㄨ甯?

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


              `4绾у挩璇㈠笀瑙﹀彂900鍏冮棬妲? consultantId=${userId}, ` +


                `totalConsultIncome=${incomeNum}, ` +


                `directInviteCount=${consultant.directInviteCount}`,


            );


          }





        }


      }





      // 解除门槛限制：直推人数达到3人及以上，或升级到5级及以上时自动解除（所有级别通用）
      // 重新查询用户信息（因为已经在事务外面了）
      const consultantRows = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (consultantRows.length > 0) {
        const consultant = consultantRows[0];
        if (consultant.thresholdBlocked && (consultant.directInviteCount >= 3 || consultant.level !== 'level_4')) {
          const pendingAmount = Number(consultant.pendingReclaimAmount) || 0;
          const incomeNum = Number(consultant.totalConsultIncome) || 0;
          const newTotalIncome = incomeNum + pendingAmount;
          await this.db
            .update(users)
            .set({
              thresholdBlocked: false,
              thresholdTriggeredAt: null,
              pendingReclaimAmount: '0',
              totalConsultIncome: newTotalIncome.toFixed(2),
            })
            .where(eq(users.id, userId));
          this.logger.log(
            `咨询师解除900元门槛: consultantId=${userId}, level=${consultant.level}, ` +
              `directInviteCount=${consultant.directInviteCount}, ` +
              `返还暂存金额=${pendingAmount}`,
          );
        }
      }


      return updated;


    });




    this.logger.log(


      `鍜ㄨ璁㈠崟确认收款骞跺畬鎴? orderId=${id}, ` +


        `status=${CONSULT_ORDER_STATUS.COMPLETED}, ` +


        `isOverflow=${order.isOverflow}`,


    );




    // 确认收款鍚庣珛鍗宠Е鍙戝崌绾т换鍔″畬鎴愭鏌ワ紙鍙栨秷浣滀笟鎻愪氦娴佺▼锛?

    try {


      await this.upgradeService.checkConsultTaskComplete(


        order.studentId,


        order.id,


        order.consultantId,


        String(order.amount),


      );


    } catch (e) {


      this.logger.error(`确认收款鍚庤Е鍙戝崌绾т换鍔″畬鎴愬け璐? ${e}`);


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


      throw new BadRequestException('当前订单状态不允许操作');


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




    // 妫€鏌ユ槸鍚︽槸绠＄悊鍛橈紙绠＄悊鍛樺彲浠ュ鏍告墍鏈夎鍗曪級


    const userList = await this.db.select().from(users).where(eq(users.id, userId));


    const currentUser = userList[0];


    const isAdmin = currentUser?.phone === '13800000000';




    if (!isAdmin && order.consultantId !== userId) {





      throw new ForbiddenException('无权操作该订单');
    }

    if (order.status !== CONSULT_ORDER_STATUS.PENDING_REVIEW) {


      throw new BadRequestException('当前订单状态不允许操作');


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




      this.logger.log(`鍜ㄨ璁㈠崟作业审核通过: orderId=${id}`);




      // 瑙﹀彂鍗囩骇浠诲姟瀹屾垚妫€鏌?

      try {


        await this.upgradeService.checkConsultTaskComplete(


          order.studentId,


          order.id,


          order.consultantId,


          String(order.amount),


        );


      } catch (e) {


        this.logger.error(`瑙﹀彂鍗囩骇浠诲姟瀹屾垚澶辫触: ${e}`);


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




      this.logger.log(`鍜ㄨ璁㈠崟浣滀笟椹冲洖閲嶄氦: orderId=${id}`);


      return this.toOrderInfo(updated[0]);


    }

  }


  /**
   * 定时任务：扫描所有超时订单并自动确认/审核
   * 由main.ts中的setInterval每分钟调用
   */
  async autoConfirmExpiredOrdersCron(): Promise<{ confirmed: number; reviewed: number }> {
    const now = new Date();
    let confirmed = 0;
    let reviewed = 0;

    try {
      const expiredOrders = await this.db
        .select()
        .from(consultOrders)
        .where(
          and(
            inArray(consultOrders.status, [
              CONSULT_ORDER_STATUS.PENDING_CONFIRM,
              CONSULT_ORDER_STATUS.PENDING_REVIEW,
            ]),
            sql`${consultOrders.autoConfirmDeadline} <= ${now}`,
          ),
        );

      if (expiredOrders.length > 0) {
        this.logger.log(`定时任务扫描到 ${expiredOrders.length} 个超时订单`);
      }

      for (const order of expiredOrders) {
        try {
          if (order.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM) {
            await this.confirmPayment(order.consultantId, order.id);
            confirmed++;
          } else if (order.status === CONSULT_ORDER_STATUS.PENDING_REVIEW) {
            await this.reviewWork(order.consultantId, order.id, { passed: true, remark: '超时自动审核通过' });
            reviewed++;
          }
        } catch (e) {
          this.logger.error(`定时任务处理订单失败: orderId=${order.id}, error=${e}`);
        }
      }

      if (confirmed > 0 || reviewed > 0) {
        this.logger.log(`定时任务完成: 自动确认${confirmed}个, 自动审核${reviewed}个`);
      }
    } catch (e) {
      this.logger.error(`定时任务扫描失败: ${e}`);
    }

    return { confirmed, reviewed };
  }
}
