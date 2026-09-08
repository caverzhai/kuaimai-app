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
var ConsultOrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultOrdersService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../database/database.module");
const schema_1 = require("@server/database/schema");
const auth_util_1 = require("@server/common/utils/auth.util");
const api_interface_1 = require("@shared/api.interface");
const upgrade_service_1 = require("../upgrade/upgrade.service");
let ConsultOrdersService = ConsultOrdersService_1 = class ConsultOrdersService {
    db;
    upgradeService;
    logger = new common_1.Logger(ConsultOrdersService_1.name);
    constructor(db, upgradeService) {
        this.db = db;
        this.upgradeService = upgradeService;
    }
    toOrderInfo(order) {
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
    toUserBrief(user) {
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
    async getDistanceBetween(studentId, consultantId) {
        const relationList = await this.db
            .select()
            .from(schema_1.teamRelations)
            .where((0, drizzle_orm_1.eq)(schema_1.teamRelations.userId, studentId));
        const relation = relationList[0];
        if (!relation) {
            return null;
        }
        const ancestors = relation.path
            .split(',')
            .filter((s) => s.length > 0);
        const index = ancestors.indexOf(consultantId);
        if (index === -1) {
            return null;
        }
        return index + 1;
    }
    async create(studentId, isInvited, dto) {
        const consultantList = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, dto.consultantId));
        const consultant = consultantList[0];
        if (!consultant) {
            throw new common_1.NotFoundException('咨询师不存在');
        }
        const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
        if (consultant.level === api_interface_1.LEVELS.JUNIOR && consultant.id !== ADMIN_ID) {
            throw new common_1.BadRequestException('初级用户不能提供咨询服务');
        }
        const distance = await this.getDistanceBetween(studentId, dto.consultantId);
        let isOverflow = false;
        let overflowToGroup = false;
        if (distance !== null) {
            const maxLayers = api_interface_1.LEVEL_LAYERS[consultant.level] ?? 0;
            if (distance > maxLayers) {
                isOverflow = true;
                overflowToGroup = true;
            }
        }
        const orderNo = (0, auth_util_1.generateOrderNo)('C');
        const amountStr = dto.amount.toFixed(2);
        const inserted = await this.db
            .insert(schema_1.consultOrders)
            .values({
            orderNo,
            studentId,
            consultantId: dto.consultantId,
            serviceType: dto.serviceType,
            amount: amountStr,
            taskLevelFrom: dto.taskLevelFrom,
            taskLevelTo: dto.taskLevelTo,
            taskIndex: dto.taskIndex,
            status: api_interface_1.CONSULT_ORDER_STATUS.PENDING_PAYMENT,
            isOverflow,
            overflowToGroup,
        })
            .returning();
        this.logger.log(`创建咨询订单: orderNo=${orderNo}, studentId=${studentId}, ` +
            `consultantId=${dto.consultantId}, distance=${distance}, ` +
            `isOverflow=${isOverflow}`);
        return this.toOrderInfo(inserted[0]);
    }
    async getStudentOrders(studentId, page, pageSize, status) {
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.consultOrders.studentId, studentId)];
        if (status) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.consultOrders.status, status));
        }
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const [countResult, items] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.consultOrders)
                .where(whereClause),
            this.db
                .select()
                .from(schema_1.consultOrders)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.consultOrders.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        const consultantIds = items.map((item) => item.consultantId);
        const consultantMap = new Map();
        if (consultantIds.length > 0) {
            const uniqueIds = [...new Set(consultantIds)];
            const consultants = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.inArray)(schema_1.users.id, uniqueIds));
            for (const c of consultants) {
                consultantMap.set(c.id, this.toUserBrief(c));
            }
        }
        const orderItems = items.map((item) => {
            const info = this.toOrderInfo(item);
            const consultant = consultantMap.get(item.consultantId);
            if (consultant) {
                info.consultant = consultant;
            }
            return info;
        });
        return {
            items: orderItems,
            total,
            page,
            pageSize,
        };
    }
    async getConsultantOrders(consultantId, page, pageSize, status) {
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.consultOrders.consultantId, consultantId)];
        if (status) {
            const statusList = status.split(',').map((s) => s.trim()).filter(Boolean);
            if (statusList.length === 1) {
                conditions.push((0, drizzle_orm_1.eq)(schema_1.consultOrders.status, statusList[0]));
            }
            else if (statusList.length > 1) {
                conditions.push((0, drizzle_orm_1.inArray)(schema_1.consultOrders.status, statusList));
            }
        }
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const [countResult, items] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.consultOrders)
                .where(whereClause),
            this.db
                .select()
                .from(schema_1.consultOrders)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.consultOrders.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        const studentIds = items.map((item) => item.studentId);
        const studentMap = new Map();
        if (studentIds.length > 0) {
            const uniqueIds = [...new Set(studentIds)];
            const students = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.inArray)(schema_1.users.id, uniqueIds));
            for (const s of students) {
                studentMap.set(s.id, this.toUserBrief(s));
            }
        }
        const orderItems = items.map((item) => {
            const info = this.toOrderInfo(item);
            const student = studentMap.get(item.studentId);
            if (student) {
                info.student = student;
            }
            return info;
        });
        return {
            items: orderItems,
            total,
            page,
            pageSize,
        };
    }
    async getOrderDetail(userId, id) {
        const orderList = await this.db
            .select()
            .from(schema_1.consultOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.studentId !== userId && order.consultantId !== userId) {
            throw new common_1.ForbiddenException('无权查看该订单');
        }
        const result = this.toOrderInfo(order);
        const otherUserId = order.studentId === userId ? order.consultantId : order.studentId;
        const otherUserList = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, otherUserId));
        if (otherUserList[0]) {
            const otherUser = this.toUserBrief(otherUserList[0]);
            if (order.studentId === userId) {
                result.consultant = otherUser;
            }
            else {
                result.student = otherUser;
            }
        }
        return result;
    }
    async uploadPaymentScreenshot(userId, id, dto) {
        const orderList = await this.db
            .select()
            .from(schema_1.consultOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.studentId !== userId) {
            throw new common_1.ForbiddenException('无权操作该订单');
        }
        if (order.status !== api_interface_1.CONSULT_ORDER_STATUS.PENDING_PAYMENT) {
            throw new common_1.BadRequestException('当前订单状态不允许上传付款凭证');
        }
        const autoConfirmDeadline = new Date();
        autoConfirmDeadline.setMinutes(autoConfirmDeadline.getMinutes() + 20);
        const updated = await this.db
            .update(schema_1.consultOrders)
            .set({
            paymentScreenshotUrl: dto.screenshotUrl,
            status: api_interface_1.CONSULT_ORDER_STATUS.PENDING_CONFIRM,
            autoConfirmDeadline,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id))
            .returning();
        this.logger.log(`咨询订单付款凭证已上传: orderId=${id}, ` +
            `status=${api_interface_1.CONSULT_ORDER_STATUS.PENDING_CONFIRM}`);
        return this.toOrderInfo(updated[0]);
    }
    async confirmPayment(userId, id) {
        const orderList = await this.db
            .select()
            .from(schema_1.consultOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.consultantId !== userId) {
            throw new common_1.ForbiddenException('无权操作该订单');
        }
        if (order.status !== api_interface_1.CONSULT_ORDER_STATUS.PENDING_CONFIRM) {
            throw new common_1.BadRequestException('当前订单状态不允许确认收款');
        }
        const now = new Date();
        const updatedOrders = await this.db.transaction(async (tx) => {
            const updated = await tx
                .update(schema_1.consultOrders)
                .set({
                status: api_interface_1.CONSULT_ORDER_STATUS.IN_SERVICE,
                paymentConfirmedAt: now,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id))
                .returning();
            if (!order.isOverflow || !order.overflowToGroup) {
                const orderAmount = String(order.amount);
                const updatedUsers = await tx
                    .update(schema_1.users)
                    .set({
                    totalConsultIncome: (0, drizzle_orm_1.sql) `${schema_1.users.totalConsultIncome} + ${orderAmount}::numeric`,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                    .returning();
                const consultant = updatedUsers[0];
                if (consultant && consultant.level === api_interface_1.LEVELS.LEVEL_4) {
                    const incomeNum = Number(consultant.totalConsultIncome);
                    if (incomeNum > 900 &&
                        consultant.directInviteCount < 3 &&
                        !consultant.thresholdBlocked) {
                        await tx
                            .update(schema_1.users)
                            .set({
                            thresholdBlocked: true,
                            thresholdTriggeredAt: now,
                        })
                            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
                        this.logger.log(`4级咨询师触发900元门槛: consultantId=${userId}, ` +
                            `totalConsultIncome=${incomeNum}, ` +
                            `directInviteCount=${consultant.directInviteCount}`);
                    }
                }
            }
            return updated;
        });
        this.logger.log(`咨询订单确认收款: orderId=${id}, ` +
            `status=${api_interface_1.CONSULT_ORDER_STATUS.IN_SERVICE}, ` +
            `isOverflow=${order.isOverflow}`);
        return this.toOrderInfo(updatedOrders[0]);
    }
    async uploadWork(userId, id, dto) {
        const orderList = await this.db
            .select()
            .from(schema_1.consultOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.studentId !== userId) {
            throw new common_1.ForbiddenException('无权操作该订单');
        }
        if (order.status !== api_interface_1.CONSULT_ORDER_STATUS.IN_SERVICE) {
            throw new common_1.BadRequestException('当前订单状态不允许提交作业');
        }
        const now = new Date();
        const autoConfirmDeadline = new Date();
        autoConfirmDeadline.setMinutes(autoConfirmDeadline.getMinutes() + 20);
        const updated = await this.db
            .update(schema_1.consultOrders)
            .set({
            workScreenshotUrl: dto.screenshotUrl,
            workSubmittedAt: now,
            status: api_interface_1.CONSULT_ORDER_STATUS.PENDING_REVIEW,
            autoConfirmDeadline,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id))
            .returning();
        this.logger.log(`咨询订单作业已提交: orderId=${id}, ` +
            `status=${api_interface_1.CONSULT_ORDER_STATUS.PENDING_REVIEW}`);
        return this.toOrderInfo(updated[0]);
    }
    async reviewWork(userId, id, dto) {
        const orderList = await this.db
            .select()
            .from(schema_1.consultOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id));
        const order = orderList[0];
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (order.consultantId !== userId) {
            throw new common_1.ForbiddenException('无权操作该订单');
        }
        if (order.status !== api_interface_1.CONSULT_ORDER_STATUS.PENDING_REVIEW) {
            throw new common_1.BadRequestException('当前订单状态不允许审核作业');
        }
        const now = new Date();
        if (dto.passed) {
            const updated = await this.db
                .update(schema_1.consultOrders)
                .set({
                status: api_interface_1.CONSULT_ORDER_STATUS.COMPLETED,
                workReviewedAt: now,
                reviewRemark: dto.remark,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id))
                .returning();
            this.logger.log(`咨询订单作业审核通过: orderId=${id}`);
            try {
                await this.upgradeService.checkConsultTaskComplete(order.studentId, order.id, order.consultantId, String(order.amount));
            }
            catch (e) {
                this.logger.error(`触发升级任务完成失败: ${e}`);
            }
            return this.toOrderInfo(updated[0]);
        }
        else {
            const updated = await this.db
                .update(schema_1.consultOrders)
                .set({
                status: api_interface_1.CONSULT_ORDER_STATUS.IN_SERVICE,
                reviewRemark: dto.remark,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.consultOrders.id, id))
                .returning();
            this.logger.log(`咨询订单作业驳回重交: orderId=${id}`);
            return this.toOrderInfo(updated[0]);
        }
    }
};
exports.ConsultOrdersService = ConsultOrdersService;
exports.ConsultOrdersService = ConsultOrdersService = ConsultOrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, upgrade_service_1.UpgradeService])
], ConsultOrdersService);
//# sourceMappingURL=consult-orders.service.js.map