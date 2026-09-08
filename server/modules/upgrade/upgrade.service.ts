import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, or } from 'drizzle-orm';

import type {
  UpgradeCenterInfo,
  UpgradeTaskInfo,
} from '@shared/api.interface';
import {
  LEVELS,
  TASK_STATUS,
  TASK_TYPE,
} from '@shared/api.interface';
import {
  upgradeTasks,
  users,
  teamRelations,
} from '@server/database/schema';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { generateInviteCode } from '@server/common/utils/auth.util';

type UpgradeTaskSelect = typeof upgradeTasks.$inferSelect;
type UserSelect = typeof users.$inferSelect;
type TeamRelationSelect = typeof teamRelations.$inferSelect;

interface TaskDefinition {
  taskIndex: number;
  taskType: string;
  title: string;
  amount: string;
  targetKind: 'mall' | 'inviter' | 'ancestor_1' | 'ancestor_2' | 'ancestor_3';
}

const LEVEL_ORDER: string[] = [
  LEVELS.JUNIOR,
  LEVELS.LEVEL_4,
  LEVELS.LEVEL_5,
  LEVELS.LEVEL_6,
  LEVELS.LEVEL_7,
  LEVELS.LEVEL_8,
];

function buildTaskDefs(
  mallAmount: string,
  inviterAmount: string,
  parentAmount: string,
  grandParentAmount: string,
  greatGrandParentAmount: string | null,
): TaskDefinition[] {
  const defs: TaskDefinition[] = [
    {
      taskIndex: 0,
      taskType: TASK_TYPE.MALL_PURCHASE,
      title: `商城购买${mallAmount}元商品`,
      amount: mallAmount,
      targetKind: 'mall',
    },
    {
      taskIndex: 1,
      taskType: TASK_TYPE.CONSULT_SERVICE,
      title: `向直推人购买${inviterAmount}元咨询服务`,
      amount: inviterAmount,
      targetKind: 'inviter',
    },
    {
      taskIndex: 2,
      taskType: TASK_TYPE.CONSULT_SERVICE,
      title: `向上级购买${parentAmount}元咨询服务`,
      amount: parentAmount,
      targetKind: 'ancestor_1',
    },
    {
      taskIndex: 3,
      taskType: TASK_TYPE.CONSULT_SERVICE,
      title: `向上上级购买${grandParentAmount}元咨询服务`,
      amount: grandParentAmount,
      targetKind: 'ancestor_2',
    },
  ];
  if (greatGrandParentAmount) {
    defs.push({
      taskIndex: 4,
      taskType: TASK_TYPE.CONSULT_SERVICE,
      title: `向上上上级购买${greatGrandParentAmount}元咨询服务`,
      amount: greatGrandParentAmount,
      targetKind: 'ancestor_3',
    });
  }
  return defs;
}

const TASK_DEFINITIONS: Record<string, TaskDefinition[]> = {
  [`${LEVELS.JUNIOR}->${LEVELS.LEVEL_4}`]: buildTaskDefs(
    '200', '300', '200', '100', '100',
  ),
  [`${LEVELS.LEVEL_4}->${LEVELS.LEVEL_5}`]: buildTaskDefs(
    '600', '1200', '600', '300', null,
  ),
  [`${LEVELS.LEVEL_5}->${LEVELS.LEVEL_6}`]: buildTaskDefs(
    '1800', '3600', '1800', '900', null,
  ),
  [`${LEVELS.LEVEL_6}->${LEVELS.LEVEL_7}`]: buildTaskDefs(
    '5400', '10800', '5400', '2700', null,
  ),
  [`${LEVELS.LEVEL_7}->${LEVELS.LEVEL_8}`]: buildTaskDefs(
    '16200', '32400', '10800', '5400', null,
  ),
};

const UNAVAILABLE_STATUS = 'unavailable';

@Injectable()
export class UpgradeService {
  private readonly logger = new Logger(UpgradeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ── Public API ────────────────────────────────────────────────

  async getUpgradeCenter(userId: string): Promise<UpgradeCenterInfo> {
    const user: UserSelect | undefined = (
      await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
    )[0];
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const currentLevel: string = user.level;
    const currentIdx: number = LEVEL_ORDER.indexOf(currentLevel);

    if (currentIdx === -1 || currentIdx >= LEVEL_ORDER.length - 1) {
      return {
        currentLevel,
        tasks: [],
      };
    }

    const nextLevel: string = LEVEL_ORDER[currentIdx + 1];
    const stageKey: string = `${currentLevel}->${nextLevel}`;
    const defs: TaskDefinition[] = TASK_DEFINITIONS[stageKey] || [];

    if (defs.length === 0) {
      return { currentLevel, nextLevel, tasks: [] };
    }

    // Ensure tasks exist
    await this.ensureTasks(userId, currentLevel, nextLevel, defs);

    // Refetch tasks ordered by task_index
    const taskRows: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, userId),
          eq(upgradeTasks.fromLevel, currentLevel),
          eq(upgradeTasks.toLevel, nextLevel),
        ),
      )
      .orderBy(upgradeTasks.taskIndex);

    // Fix old tasks: assign admin as target if consult task has no targetId
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    for (let i = 0; i < taskRows.length; i++) {
      const task = taskRows[i];
      if (
        task.taskType === TASK_TYPE.CONSULT_SERVICE &&
        !task.targetId
      ) {
        await this.db
          .update(upgradeTasks)
          .set({ targetId: ADMIN_ID })
          .where(eq(upgradeTasks.id, task.id));
        taskRows[i] = { ...task, targetId: ADMIN_ID };
        this.logger.log(
          `Assigned admin as target for task: taskId=${task.id}, index=${task.taskIndex}`,
        );
      }
    }

    // Auto-start next task if previous task is completed (fix for old tasks)
    this.logger.log(
      `Auto-start check: userId=${userId}, taskCount=${taskRows.length}, tasks=${taskRows.map(t => `idx=${t.taskIndex},status=${t.status},target=${t.targetId ? 'yes' : 'no'}`).join('|')}`,
    );
    for (let i = 1; i < taskRows.length; i++) {
      const prevTask = taskRows[i - 1];
      const currTask = taskRows[i];
      // Auto-start if previous task completed and current task is pending or unavailable
      if (
        prevTask.status === TASK_STATUS.COMPLETED &&
        (currTask.status === TASK_STATUS.PENDING || currTask.status === UNAVAILABLE_STATUS)
      ) {
        await this.db
          .update(upgradeTasks)
          .set({ status: TASK_STATUS.IN_PROGRESS })
          .where(eq(upgradeTasks.id, currTask.id));
        taskRows[i] = { ...currTask, status: TASK_STATUS.IN_PROGRESS };
        this.logger.log(
          `Auto-started task on getUpgradeCenter: taskId=${currTask.id}, index=${currTask.taskIndex}, oldStatus=${currTask.status}`,
        );
      }
    }

    const tasks: UpgradeTaskInfo[] = taskRows.map(
      (row: UpgradeTaskSelect): UpgradeTaskInfo =>
        this.mapTaskInfo(row),
    );

    return { currentLevel, nextLevel, tasks };
  }

  async startTask(taskId: string, userId: string): Promise<UpgradeTaskInfo> {
    const task: UpgradeTaskSelect | undefined = (
      await this.db
        .select()
        .from(upgradeTasks)
        .where(eq(upgradeTasks.id, taskId))
        .limit(1)
    )[0];

    if (!task) {
      throw new NotFoundException('任务不存在');
    }
    if (task.userId !== userId) {
      throw new ForbiddenException('无权操作此任务');
    }
    if (task.status === UNAVAILABLE_STATUS) {
      throw new BadRequestException('任务不可用（无目标上级）');
    }
    if (task.status !== TASK_STATUS.PENDING) {
      throw new BadRequestException('任务状态不允许开始');
    }

    // Check previous task is completed
    if (task.taskIndex > 0) {
      const prevTask: UpgradeTaskSelect | undefined = (
        await this.db
          .select()
          .from(upgradeTasks)
          .where(
            and(
              eq(upgradeTasks.userId, userId),
              eq(upgradeTasks.fromLevel, task.fromLevel),
              eq(upgradeTasks.toLevel, task.toLevel),
              eq(upgradeTasks.taskIndex, task.taskIndex - 1),
            ),
          )
          .limit(1)
      )[0];
      if (!prevTask || prevTask.status !== TASK_STATUS.COMPLETED) {
        throw new BadRequestException('请先完成前一个任务');
      }
    }

    const updated: UpgradeTaskSelect[] = await this.db
      .update(upgradeTasks)
      .set({ status: TASK_STATUS.IN_PROGRESS })
      .where(eq(upgradeTasks.id, taskId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('任务不存在');
    }

    return this.mapTaskInfo(updated[0]);
  }

  // ── Cross-module helpers ──────────────────────────────────────

  /**
   * Called by mall-orders when a mall order is completed.
   * Checks if the user has an in-progress mall_purchase task with matching amount.
   */
  async checkMallTaskComplete(
    userId: string,
    mallOrderId: string,
    totalAmount: string,
  ): Promise<void> {
    // Find any pending or in-progress mall task for this user
    const inProgressTasks: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, userId),
          or(
            eq(upgradeTasks.status, TASK_STATUS.IN_PROGRESS),
            eq(upgradeTasks.status, TASK_STATUS.PENDING),
          ),
          eq(upgradeTasks.taskType, TASK_TYPE.MALL_PURCHASE),
        ),
      );

    for (const task of inProgressTasks) {
      const taskAmount: number = Number(task.amount);
      const orderAmount: number = Number(totalAmount);
      if (orderAmount >= taskAmount) {
        await this.completeTask(task.id, { mallOrderId });
      }
    }
  }

  /**
   * Called by consult-orders when a consult order is completed.
   * Checks if the student has an in-progress consult_service task
   * whose target matches the consultant and amount matches.
   */
  async checkConsultTaskComplete(
    userId: string,
    orderId: string,
    consultantId: string,
    amount: string,
  ): Promise<void> {
    const inProgressTasks: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, userId),
          eq(upgradeTasks.status, TASK_STATUS.IN_PROGRESS),
          eq(upgradeTasks.taskType, TASK_TYPE.CONSULT_SERVICE),
        ),
      );

    for (const task of inProgressTasks) {
      if (!task.targetId || task.targetId !== consultantId) continue;
      // amount match (within precision, numeric comparison)
      if (Number(task.amount) === Number(amount)) {
        await this.completeTask(task.id, { orderId });
      }
    }
  }

  // ── Internal: task completion + upgrade flow ──────────────────

  private async completeTask(
    taskId: string,
    extras: { mallOrderId?: string; orderId?: string },
  ): Promise<void> {
    const now: Date = new Date();
    const updateData: Record<string, string | Date> = {
      status: TASK_STATUS.COMPLETED,
      completedAt: now,
    };
    if (extras.mallOrderId) {
      updateData.mallOrderId = extras.mallOrderId;
    }
    if (extras.orderId) {
      updateData.orderId = extras.orderId;
    }

    const updated: UpgradeTaskSelect[] = await this.db
      .update(upgradeTasks)
      .set(updateData)
      .where(eq(upgradeTasks.id, taskId))
      .returning();

    if (updated.length === 0) return;
    const task: UpgradeTaskSelect = updated[0];

    this.logger.log(
      `Upgrade task completed: taskId=${task.id}, user=${task.userId}, ` +
        `${task.fromLevel}->${task.toLevel}, index=${task.taskIndex}`,
    );

    // Check if this is the last task in the stage
    const allTasks: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, task.userId),
          eq(upgradeTasks.fromLevel, task.fromLevel),
          eq(upgradeTasks.toLevel, task.toLevel),
        ),
      );

    const defs: TaskDefinition[] =
      TASK_DEFINITIONS[`${task.fromLevel}->${task.toLevel}`] || [];
    const expectedCount: number = defs.length;

    // All tasks of the stage are completed
    if (
      allTasks.length >= expectedCount &&
      allTasks.every(
        (t: UpgradeTaskSelect): boolean => t.status === TASK_STATUS.COMPLETED,
      )
    ) {
      await this.tryUpgrade(task.userId, task.fromLevel, task.toLevel);
    } else {
      // Auto-start the next task (change from pending to in_progress)
      const nextTaskIndex = task.taskIndex + 1;
      const nextTask = allTasks.find(
        (t: UpgradeTaskSelect): boolean =>
          t.taskIndex === nextTaskIndex && t.status === TASK_STATUS.PENDING,
      );
      if (nextTask) {
        await this.db
          .update(upgradeTasks)
          .set({ status: TASK_STATUS.IN_PROGRESS })
          .where(eq(upgradeTasks.id, nextTask.id));
        this.logger.log(
          `Auto-started next task: taskId=${nextTask.id}, index=${nextTask.taskIndex}`,
        );
      }
    }
  }

  private async tryUpgrade(
    userId: string,
    fromLevel: string,
    toLevel: string,
  ): Promise<void> {
    // Level 7 upgrade requires company audit approved
    if (toLevel === LEVELS.LEVEL_7) {
      const user: UserSelect | undefined = (
        await this.db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      )[0];
      if (!user || user.companyAuditStatus !== 'approved') {
        this.logger.log(
          `Upgrade to level_7 pending company audit: userId=${userId}`,
        );
        return; // 任务保持完成，不升级
      }
    }

    const updateData: Record<string, string> = { level: toLevel };

    // Level 4 and above: generate invite code if not present
    const levelNum: number = LEVEL_ORDER.indexOf(toLevel);
    const isHighLevel: boolean = levelNum >= LEVEL_ORDER.indexOf(LEVELS.LEVEL_4);

    if (isHighLevel) {
      const code: string = await this.generateUniqueInviteCode();
      updateData.inviteCode = code;
    }

    await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    this.logger.log(
      `User upgraded: userId=${userId}, ${fromLevel} -> ${toLevel}`,
    );
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 10; i += 1) {
      const code: string = generateInviteCode();
      const existing: { id: string }[] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.inviteCode, code))
        .limit(1);
      if (existing.length === 0) return code;
    }
    // Fallback with timestamp
    return generateInviteCode() + Date.now().toString(36).slice(-4);
  }

  // ── Internal: task initialization ─────────────────────────────

  private async ensureTasks(
    userId: string,
    fromLevel: string,
    toLevel: string,
    defs: TaskDefinition[],
  ): Promise<void> {
    const existing: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, userId),
          eq(upgradeTasks.fromLevel, fromLevel),
          eq(upgradeTasks.toLevel, toLevel),
        ),
      );

    if (existing.length >= defs.length) return;

    // Lookup team relation for ancestor targets
    const teamRow: TeamRelationSelect | undefined = (
      await this.db
        .select()
        .from(teamRelations)
        .where(eq(teamRelations.userId, userId))
        .limit(1)
    )[0];

    const user: UserSelect | undefined = (
      await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    )[0];

    const existingIndices: Set<number> = new Set(
      existing.map((t: UpgradeTaskSelect): number => t.taskIndex),
    );

    type InsertTask = typeof upgradeTasks.$inferInsert;
    const toInsert: InsertTask[] = [];

    for (const def of defs) {
      if (existingIndices.has(def.taskIndex)) continue;

      let targetId: string | null = null;
      // First task auto-starts, others start as pending
      let status: string = def.taskIndex === 0 ? TASK_STATUS.IN_PROGRESS : TASK_STATUS.PENDING;

      if (def.targetKind === 'mall') {
        targetId = null;
      } else if (def.targetKind === 'inviter') {
        targetId = user?.inviterId ?? null;
      } else if (def.targetKind === 'ancestor_1') {
        targetId = this.getAncestorFromPath(teamRow?.path, 1) ?? null;
      } else if (def.targetKind === 'ancestor_2') {
        targetId = this.getAncestorFromPath(teamRow?.path, 2) ?? null;
      } else if (def.targetKind === 'ancestor_3') {
        targetId = this.getAncestorFromPath(teamRow?.path, 3) ?? null;
      }

      // For consult tasks without a target, assign to admin (零号线)
      // All payments go to admin when no upper-level consultant exists
      if (
        def.taskType === TASK_TYPE.CONSULT_SERVICE &&
        !targetId
      ) {
        targetId = '4b51567f-8020-415c-8b5d-1de2f28e141d'; // 管理员零号线ID
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

    if (toInsert.length === 0) return;

    await this.db.insert(upgradeTasks).values(toInsert);
  }

  /**
   * Parse team_relations.path (format: ",uuid1,uuid2,uuid3,自己,")
   * path 包含当前用户自己，所以：
   * level=1 -> 直接上级（倒数第二个）
   * level=2 -> 上上级（倒数第三个）
   * level=3 -> 上上上级（倒数第四个）
   */
  private getAncestorFromPath(
    path: string | undefined,
    level: number,
  ): string | null {
    if (!path || path.length <= 2) return null;
    const segments: string[] = path.split(',').filter((s: string): boolean => s.length > 0);
    // segments 最后一个是自己，所以要多减1
    const index = segments.length - level - 1;
    if (index < 0) return null;
    return segments[index] ?? null;
  }

  // ── Public helper: get ancestor (used by other modules) ───────

  async getAncestorUserId(userId: string, level: number): Promise<string | null> {
    const teamRow: TeamRelationSelect | undefined = (
      await this.db
        .select()
        .from(teamRelations)
        .where(eq(teamRelations.userId, userId))
        .limit(1)
    )[0];
    return this.getAncestorFromPath(teamRow?.path, level);
  }

  // ── Mapping ───────────────────────────────────────────────────

  private mapTaskInfo(row: UpgradeTaskSelect): UpgradeTaskInfo {
    const info: UpgradeTaskInfo = {
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
    if (row.targetId) info.targetId = row.targetId;
    if (row.orderId) info.orderId = row.orderId;
    if (row.mallOrderId) info.mallOrderId = row.mallOrderId;
    if (row.completedAt) info.completedAt = row.completedAt.toISOString();
    return info;
  }
}
