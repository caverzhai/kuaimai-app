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
var UpgradeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradeService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const api_interface_1 = require("@shared/api.interface");
const schema_1 = require("@server/database/schema");
const common_2 = require("@nestjs/common");
const auth_util_1 = require("@server/common/utils/auth.util");
const LEVEL_ORDER = [
    api_interface_1.LEVELS.JUNIOR,
    api_interface_1.LEVELS.LEVEL_4,
    api_interface_1.LEVELS.LEVEL_5,
    api_interface_1.LEVELS.LEVEL_6,
    api_interface_1.LEVELS.LEVEL_7,
    api_interface_1.LEVELS.LEVEL_8,
];
function buildTaskDefs(mallAmount, inviterAmount, parentAmount, grandParentAmount, greatGrandParentAmount) {
    const defs = [
        {
            taskIndex: 0,
            taskType: api_interface_1.TASK_TYPE.MALL_PURCHASE,
            title: `商城购买${mallAmount}元商品`,
            amount: mallAmount,
            targetKind: 'mall',
        },
        {
            taskIndex: 1,
            taskType: api_interface_1.TASK_TYPE.CONSULT_SERVICE,
            title: `向直推人购买${inviterAmount}元咨询服务`,
            amount: inviterAmount,
            targetKind: 'inviter',
        },
        {
            taskIndex: 2,
            taskType: api_interface_1.TASK_TYPE.CONSULT_SERVICE,
            title: `向直接上级购买${parentAmount}元咨询服务`,
            amount: parentAmount,
            targetKind: 'ancestor_1',
        },
        {
            taskIndex: 3,
            taskType: api_interface_1.TASK_TYPE.CONSULT_SERVICE,
            title: `向树上上级购买${grandParentAmount}元咨询服务`,
            amount: grandParentAmount,
            targetKind: 'ancestor_2',
        },
    ];
    if (greatGrandParentAmount) {
        defs.push({
            taskIndex: 4,
            taskType: api_interface_1.TASK_TYPE.CONSULT_SERVICE,
            title: `向树上上上级购买${greatGrandParentAmount}元咨询服务`,
            amount: greatGrandParentAmount,
            targetKind: 'ancestor_3',
        });
    }
    return defs;
}
const TASK_DEFINITIONS = {
    [`${api_interface_1.LEVELS.JUNIOR}->${api_interface_1.LEVELS.LEVEL_4}`]: buildTaskDefs('200', '300', '200', '100', '100'),
    [`${api_interface_1.LEVELS.LEVEL_4}->${api_interface_1.LEVELS.LEVEL_5}`]: buildTaskDefs('600', '1200', '600', '300', null),
    [`${api_interface_1.LEVELS.LEVEL_5}->${api_interface_1.LEVELS.LEVEL_6}`]: buildTaskDefs('1800', '3600', '1800', '900', null),
    [`${api_interface_1.LEVELS.LEVEL_6}->${api_interface_1.LEVELS.LEVEL_7}`]: buildTaskDefs('5400', '10800', '5400', '2700', null),
    [`${api_interface_1.LEVELS.LEVEL_7}->${api_interface_1.LEVELS.LEVEL_8}`]: buildTaskDefs('16200', '32400', '10800', '5400', null),
};
const UNAVAILABLE_STATUS = 'unavailable';
let UpgradeService = UpgradeService_1 = class UpgradeService {
    db;
    logger = new common_1.Logger(UpgradeService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getUpgradeCenter(userId) {
        const user = (await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1))[0];
        if (!user) {
            throw new common_2.NotFoundException('用户不存在');
        }
        const currentLevel = user.level;
        const currentIdx = LEVEL_ORDER.indexOf(currentLevel);
        if (currentIdx === -1 || currentIdx >= LEVEL_ORDER.length - 1) {
            return {
                currentLevel,
                tasks: [],
            };
        }
        const nextLevel = LEVEL_ORDER[currentIdx + 1];
        const stageKey = `${currentLevel}->${nextLevel}`;
        const defs = TASK_DEFINITIONS[stageKey] || [];
        if (defs.length === 0) {
            return { currentLevel, nextLevel, tasks: [] };
        }
        await this.ensureTasks(userId, currentLevel, nextLevel, defs);
        const taskRows = await this.db
            .select()
            .from(schema_1.upgradeTasks)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.userId, userId), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.fromLevel, currentLevel), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.toLevel, nextLevel)))
            .orderBy(schema_1.upgradeTasks.taskIndex);
        const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
        for (let i = 0; i < taskRows.length; i++) {
            const task = taskRows[i];
            if (task.taskType === api_interface_1.TASK_TYPE.CONSULT_SERVICE &&
                !task.targetId) {
                await this.db
                    .update(schema_1.upgradeTasks)
                    .set({ targetId: ADMIN_ID })
                    .where((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.id, task.id));
                taskRows[i] = { ...task, targetId: ADMIN_ID };
                this.logger.log(`Assigned admin as target for task: taskId=${task.id}, index=${task.taskIndex}`);
            }
        }
        this.logger.log(`Auto-start check: userId=${userId}, taskCount=${taskRows.length}, tasks=${taskRows.map(t => `idx=${t.taskIndex},status=${t.status},target=${t.targetId ? 'yes' : 'no'}`).join('|')}`);
        for (let i = 1; i < taskRows.length; i++) {
            const prevTask = taskRows[i - 1];
            const currTask = taskRows[i];
            if (prevTask.status === api_interface_1.TASK_STATUS.COMPLETED &&
                (currTask.status === api_interface_1.TASK_STATUS.PENDING || currTask.status === UNAVAILABLE_STATUS)) {
                await this.db
                    .update(schema_1.upgradeTasks)
                    .set({ status: api_interface_1.TASK_STATUS.IN_PROGRESS })
                    .where((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.id, currTask.id));
                taskRows[i] = { ...currTask, status: api_interface_1.TASK_STATUS.IN_PROGRESS };
                this.logger.log(`Auto-started task on getUpgradeCenter: taskId=${currTask.id}, index=${currTask.taskIndex}, oldStatus=${currTask.status}`);
            }
        }
        const tasks = taskRows.map((row) => this.mapTaskInfo(row));
        return { currentLevel, nextLevel, tasks };
    }
    async startTask(taskId, userId) {
        const task = (await this.db
            .select()
            .from(schema_1.upgradeTasks)
            .where((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.id, taskId))
            .limit(1))[0];
        if (!task) {
            throw new common_2.NotFoundException('任务不存在');
        }
        if (task.userId !== userId) {
            throw new common_2.ForbiddenException('无权操作此任务');
        }
        if (task.status === UNAVAILABLE_STATUS) {
            throw new common_2.BadRequestException('任务不可用（无目标上级）');
        }
        if (task.status !== api_interface_1.TASK_STATUS.PENDING) {
            throw new common_2.BadRequestException('任务状态不允许开始');
        }
        if (task.taskIndex > 0) {
            const prevTask = (await this.db
                .select()
                .from(schema_1.upgradeTasks)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.userId, userId), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.fromLevel, task.fromLevel), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.toLevel, task.toLevel), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.taskIndex, task.taskIndex - 1)))
                .limit(1))[0];
            if (!prevTask || prevTask.status !== api_interface_1.TASK_STATUS.COMPLETED) {
                throw new common_2.BadRequestException('请先完成前一个任务');
            }
        }
        const updated = await this.db
            .update(schema_1.upgradeTasks)
            .set({ status: api_interface_1.TASK_STATUS.IN_PROGRESS })
            .where((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.id, taskId))
            .returning();
        if (updated.length === 0) {
            throw new common_2.NotFoundException('任务不存在');
        }
        return this.mapTaskInfo(updated[0]);
    }
    async checkMallTaskComplete(userId, mallOrderId, totalAmount) {
        const inProgressTasks = await this.db
            .select()
            .from(schema_1.upgradeTasks)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.userId, userId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.status, api_interface_1.TASK_STATUS.IN_PROGRESS), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.status, api_interface_1.TASK_STATUS.PENDING)), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.taskType, api_interface_1.TASK_TYPE.MALL_PURCHASE)));
        for (const task of inProgressTasks) {
            const taskAmount = Number(task.amount);
            const orderAmount = Number(totalAmount);
            if (orderAmount >= taskAmount) {
                await this.completeTask(task.id, { mallOrderId });
            }
        }
    }
    async checkConsultTaskComplete(userId, orderId, consultantId, amount) {
        const inProgressTasks = await this.db
            .select()
            .from(schema_1.upgradeTasks)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.userId, userId), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.status, api_interface_1.TASK_STATUS.IN_PROGRESS), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.taskType, api_interface_1.TASK_TYPE.CONSULT_SERVICE)));
        for (const task of inProgressTasks) {
            if (!task.targetId || task.targetId !== consultantId)
                continue;
            if (Number(task.amount) === Number(amount)) {
                await this.completeTask(task.id, { orderId });
            }
        }
    }
    async completeTask(taskId, extras) {
        const now = new Date();
        const updateData = {
            status: api_interface_1.TASK_STATUS.COMPLETED,
            completedAt: now,
        };
        if (extras.mallOrderId) {
            updateData.mallOrderId = extras.mallOrderId;
        }
        if (extras.orderId) {
            updateData.orderId = extras.orderId;
        }
        const updated = await this.db
            .update(schema_1.upgradeTasks)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.id, taskId))
            .returning();
        if (updated.length === 0)
            return;
        const task = updated[0];
        this.logger.log(`Upgrade task completed: taskId=${task.id}, user=${task.userId}, ` +
            `${task.fromLevel}->${task.toLevel}, index=${task.taskIndex}`);
        const allTasks = await this.db
            .select()
            .from(schema_1.upgradeTasks)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.userId, task.userId), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.fromLevel, task.fromLevel), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.toLevel, task.toLevel)));
        const defs = TASK_DEFINITIONS[`${task.fromLevel}->${task.toLevel}`] || [];
        const expectedCount = defs.length;
        if (allTasks.length >= expectedCount &&
            allTasks.every((t) => t.status === api_interface_1.TASK_STATUS.COMPLETED)) {
            await this.tryUpgrade(task.userId, task.fromLevel, task.toLevel);
        }
        else {
            const nextTaskIndex = task.taskIndex + 1;
            const nextTask = allTasks.find((t) => t.taskIndex === nextTaskIndex && t.status === api_interface_1.TASK_STATUS.PENDING);
            if (nextTask) {
                await this.db
                    .update(schema_1.upgradeTasks)
                    .set({ status: api_interface_1.TASK_STATUS.IN_PROGRESS })
                    .where((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.id, nextTask.id));
                this.logger.log(`Auto-started next task: taskId=${nextTask.id}, index=${nextTask.taskIndex}`);
            }
        }
    }
    async tryUpgrade(userId, fromLevel, toLevel) {
        if (toLevel === api_interface_1.LEVELS.LEVEL_7) {
            const user = (await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                .limit(1))[0];
            if (!user || user.companyAuditStatus !== 'approved') {
                this.logger.log(`Upgrade to level_7 pending company audit: userId=${userId}`);
                return;
            }
        }
        const updateData = { level: toLevel };
        const levelNum = LEVEL_ORDER.indexOf(toLevel);
        const isHighLevel = levelNum >= LEVEL_ORDER.indexOf(api_interface_1.LEVELS.LEVEL_4);
        if (isHighLevel) {
            const code = await this.generateUniqueInviteCode();
            updateData.inviteCode = code;
        }
        await this.db
            .update(schema_1.users)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        this.logger.log(`User upgraded: userId=${userId}, ${fromLevel} -> ${toLevel}`);
    }
    async generateUniqueInviteCode() {
        for (let i = 0; i < 10; i += 1) {
            const code = (0, auth_util_1.generateInviteCode)();
            const existing = await this.db
                .select({ id: schema_1.users.id })
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.inviteCode, code))
                .limit(1);
            if (existing.length === 0)
                return code;
        }
        return (0, auth_util_1.generateInviteCode)() + Date.now().toString(36).slice(-4);
    }
    async ensureTasks(userId, fromLevel, toLevel, defs) {
        const existing = await this.db
            .select()
            .from(schema_1.upgradeTasks)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.upgradeTasks.userId, userId), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.fromLevel, fromLevel), (0, drizzle_orm_1.eq)(schema_1.upgradeTasks.toLevel, toLevel)));
        if (existing.length >= defs.length)
            return;
        const teamRow = (await this.db
            .select()
            .from(schema_1.teamRelations)
            .where((0, drizzle_orm_1.eq)(schema_1.teamRelations.userId, userId))
            .limit(1))[0];
        const user = (await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .limit(1))[0];
        const existingIndices = new Set(existing.map((t) => t.taskIndex));
        const toInsert = [];
        for (const def of defs) {
            if (existingIndices.has(def.taskIndex))
                continue;
            let targetId = null;
            let status = def.taskIndex === 0 ? api_interface_1.TASK_STATUS.IN_PROGRESS : api_interface_1.TASK_STATUS.PENDING;
            if (def.targetKind === 'mall') {
                targetId = null;
            }
            else if (def.targetKind === 'inviter') {
                targetId = user?.inviterId ?? null;
            }
            else if (def.targetKind === 'ancestor_1') {
                targetId = teamRow?.parentId ?? null;
            }
            else if (def.targetKind === 'ancestor_2') {
                targetId = this.getAncestorFromPath(teamRow?.path, 2) ?? null;
            }
            else if (def.targetKind === 'ancestor_3') {
                targetId = this.getAncestorFromPath(teamRow?.path, 3) ?? null;
            }
            if (def.taskType === api_interface_1.TASK_TYPE.CONSULT_SERVICE &&
                !targetId) {
                targetId = '4b51567f-8020-415c-8b5d-1de2f28e141d';
            }
            toInsert.push({
                userId,
                fromLevel,
                toLevel,
                taskIndex: def.taskIndex,
                taskType: def.taskType,
                title: def.title,
                amount: def.amount,
                status,
                targetId,
            });
        }
        if (toInsert.length === 0)
            return;
        await this.db.insert(schema_1.upgradeTasks).values(toInsert);
    }
    getAncestorFromPath(path, level) {
        if (!path || path.length <= 2)
            return null;
        const segments = path.split(',').filter((s) => s.length > 0);
        if (segments.length < level)
            return null;
        return segments[segments.length - level] ?? null;
    }
    async getAncestorUserId(userId, level) {
        const teamRow = (await this.db
            .select()
            .from(schema_1.teamRelations)
            .where((0, drizzle_orm_1.eq)(schema_1.teamRelations.userId, userId))
            .limit(1))[0];
        return this.getAncestorFromPath(teamRow?.path, level);
    }
    mapTaskInfo(row) {
        const info = {
            id: row.id,
            userId: row.userId,
            fromLevel: row.fromLevel,
            toLevel: row.toLevel,
            taskIndex: row.taskIndex,
            taskType: row.taskType,
            title: row.title,
            amount: String(row.amount),
            status: row.status,
            createdAt: row.createdAt.toISOString(),
        };
        if (row.targetId)
            info.targetId = row.targetId;
        if (row.orderId)
            info.orderId = row.orderId;
        if (row.mallOrderId)
            info.mallOrderId = row.mallOrderId;
        if (row.completedAt)
            info.completedAt = row.completedAt.toISOString();
        return info;
    }
};
exports.UpgradeService = UpgradeService;
exports.UpgradeService = UpgradeService = UpgradeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], UpgradeService);
//# sourceMappingURL=upgrade.service.js.map