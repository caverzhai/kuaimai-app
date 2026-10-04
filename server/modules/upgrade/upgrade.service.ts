import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, or, inArray, count, isNotNull, sql } from 'drizzle-orm';

import type {
  UpgradeCenterInfo,
  UpgradeTaskInfo,
} from '@shared/api.interface';
import {
  LEVELS,
  TASK_STATUS,
  TASK_TYPE,
  MALL_ORDER_STATUS,
  CONSULT_ORDER_STATUS,
} from '@shared/api.interface';
import {
  upgradeTasks,
  users,
  teamRelations,
  mallOrders,
  consultOrders,
} from '@server/database/schema';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { generateInviteCode } from '@server/common/utils/auth.util';
import { UsersService } from '../users/users.service';

type UpgradeTaskSelect = typeof upgradeTasks.$inferSelect;
type UserSelect = typeof users.$inferSelect;
type TeamRelationSelect = typeof teamRelations.$inferSelect;

interface TaskDefinition {
  taskIndex: number;
  taskType: string;
  title: string;
  amount: string;
  targetKind: string;
}

const LEVEL_ORDER: string[] = [
  LEVELS.JUNIOR,
  LEVELS.LEVEL_4,
  LEVELS.LEVEL_5,
  LEVELS.LEVEL_6,
  LEVELS.LEVEL_7,
  LEVELS.LEVEL_8,
  LEVELS.LEVEL_9,
];

/**
 * 生成目标级别 L（4-9）的升级任务定义
 *  - 商品金额  mall   = 200 * 2^(L-4)
 *  - 入行老师(直推)    = mall * 1.5
 *  - 团队树上1级(直接上级) = mall
 *  - 上2级 ~ 上(L-1)级     = mall / 2
 */
function buildStageDefs(L: number): TaskDefinition[] {
  const mall = 200 * Math.pow(2, L - 4);
  const inviter = mall * 1.5;
  const upper = mall / 2;
  const defs: TaskDefinition[] = [];

  // 0号：商城购买商品
  defs.push({
    taskIndex: 0,
    taskType: TASK_TYPE.MALL_PURCHASE,
    title: `商城购买${mall}元商品`,
    amount: String(mall),
    targetKind: 'mall',
  });
  // 1号：向入行老师（直推人）购买
  defs.push({
    taskIndex: 1,
    taskType: TASK_TYPE.CONSULT_SERVICE,
    title: `向入行老师购买${inviter}元咨询服务`,
    amount: String(inviter),
    targetKind: 'inviter',
  });
  // 2号起：团队树往上 L-1 级
  for (let k = 1; k <= L - 1; k += 1) {
    const amt = k === 1 ? mall : upper;
    defs.push({
      taskIndex: 1 + k,
      taskType: TASK_TYPE.CONSULT_SERVICE,
      title: `向${k}星咨询师购买${amt}元咨询服务`,
      amount: String(amt),
      targetKind: `ancestor_${k}`,
    });
  }
  return defs;
}

const TASK_DEFINITIONS: Record<string, TaskDefinition[]> = (() => {
  const map: Record<string, TaskDefinition[]> = {};
  for (let i = 1; i < LEVEL_ORDER.length; i += 1) {
    const from = LEVEL_ORDER[i - 1];
    const to = LEVEL_ORDER[i];
    map[`${from}->${to}`] = buildStageDefs(i + 3); // i=1 -> L=4
  }
  return map;
})();


const UNAVAILABLE_STATUS = 'unavailable';

@Injectable()
export class UpgradeService {
  private readonly logger = new Logger(UpgradeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly usersService: UsersService,
  ) {}

  // ── Public API ────────────────────────────────────────────────

  /** 计算当前用户的下一级与任务定义；返回 null 表示已到顶 */
  private async getStageContext(userId: string): Promise<{
    user: UserSelect;
    currentLevel: string;
    nextLevel: string;
    defs: TaskDefinition[];
  } | null> {
    const user: UserSelect | undefined = (
      await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
    )[0];
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const currentLevel: string = user.level;
    const currentIdx: number = LEVEL_ORDER.indexOf(currentLevel);
    if (currentIdx === -1 || currentIdx >= LEVEL_ORDER.length - 1) return null;
    const nextLevel: string = LEVEL_ORDER[currentIdx + 1];
    const defs: TaskDefinition[] = TASK_DEFINITIONS[`${currentLevel}->${nextLevel}`] || [];
    if (defs.length === 0) return null;
    return { user, currentLevel, nextLevel, defs };
  }

  async getUpgradeCenter(userId: string): Promise<UpgradeCenterInfo> {
    const ctx = await this.getStageContext(userId);
    if (!ctx) {
      const lv: string = (
        await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
      )[0]?.level ?? '';
      return { currentLevel: lv, tasks: [] };
    }
    const { currentLevel, nextLevel, defs } = ctx;

    // 硬门禁：未绑定邀请人，取消已生成任务，强制先补绑邀请人，绑定前不开放任何任务
    if (!ctx.user.isInvited) {
      await this.clearTasksForUnbound(userId);
      return { currentLevel, tasks: [], needBindInviter: true };
    }

    // 先查该级是否已生成过任务：为 0 说明用户尚未确认升级，先出确认按钮，不开放任务
    const existingRow: { count: number | string }[] = await this.db
      .select({ count: count() })
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, userId),
          eq(upgradeTasks.fromLevel, currentLevel),
          eq(upgradeTasks.toLevel, nextLevel),
        ),
      );
    // 第一次升级（初级->四级）是用户的首个任务，直接自动开始，不弹确认；
    // 完成四级之后再往上，才需要本人确认升级
    const isFirstStage = nextLevel === 'level_4';
    if (!isFirstStage && Number(existingRow[0]?.count ?? 0) === 0) {
      return { currentLevel, nextLevel, tasks: [], needConfirmUpgrade: true };
    }

    return this.buildCenterInfo(userId, currentLevel, nextLevel, defs);
  }

  /** 用户本人确认要升级后，才生成并开放整级任务 */
  async confirmNextLevel(userId: string): Promise<UpgradeCenterInfo> {
    const ctx = await this.getStageContext(userId);
    if (!ctx) {
      const lv: string = (
        await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
      )[0]?.level ?? '';
      return { currentLevel: lv, tasks: [] };
    }
    const { currentLevel, nextLevel, defs } = ctx;
    if (!ctx.user.isInvited) {
      await this.clearTasksForUnbound(userId);
      return { currentLevel, tasks: [], needBindInviter: true };
    }
    await this.ensureTasks(userId, currentLevel, nextLevel, defs);
    return this.buildCenterInfo(userId, currentLevel, nextLevel, defs);
  }

  /** 已确认升级后：补齐任务、自动开始、修复旧数据，返回完整任务列表 */
  private async buildCenterInfo(
    userId: string,
    currentLevel: string,
    nextLevel: string,
    defs: TaskDefinition[],
  ): Promise<UpgradeCenterInfo> {
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

    // Fix old tasks: 无 targetId 的咨询任务按"自己path->直推人path"重算真实收款人，仍无才兜底管理员
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    const fixOwner = (
      await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
    )[0];
    const fixSelfTeam = (
      await this.db.select().from(teamRelations).where(eq(teamRelations.userId, userId)).limit(1)
    )[0];
    let fixInviterTeam: TeamRelationSelect | undefined;
    if (fixOwner?.inviterId) {
      fixInviterTeam = (
        await this.db.select().from(teamRelations).where(eq(teamRelations.userId, fixOwner.inviterId)).limit(1)
      )[0];
    }
    const inTree: boolean = !!fixSelfTeam?.path;
    for (let i = 0; i < taskRows.length; i++) {
      const task = taskRows[i];
      if (task.taskType !== TASK_TYPE.CONSULT_SERVICE) continue;
      if (task.status === TASK_STATUS.COMPLETED) continue;
      const fdef = defs.find((d) => d.taskIndex === task.taskIndex);
      const isAncestor = !!fdef?.targetKind?.startsWith('ancestor_');

      // 资金安全：已有在途/已完成订单（钱已付），不改收款人
      const tOrders = await this.db
        .select({ status: consultOrders.status })
        .from(consultOrders)
        .where(eq(consultOrders.taskId, task.id));
      const hasLiveOrder = tOrders.some(
        (o) => o.status !== CONSULT_ORDER_STATUS.PENDING_PAYMENT,
      );

      const patch: Record<string, string | null> = {};

      if (inTree) {
        // 已进树（位置已锁定）：按真实 path 确定收款人并解锁
        let expected: string | null = null;
        if (fdef?.targetKind === 'inviter') expected = fixOwner?.inviterId ?? null;
        else if (isAncestor) {
          const fd = Number(fdef.targetKind.slice('ancestor_'.length));
          expected = this.getAncestorFromPath(fixSelfTeam.path, fd);
        }
        if (!expected) expected = ADMIN_ID;
        if (!hasLiveOrder && expected !== task.targetId) {
          patch.targetId = expected;
          await this.db
            .delete(consultOrders)
            .where(
              and(
                eq(consultOrders.taskId, task.id),
                eq(consultOrders.status, CONSULT_ORDER_STATUS.PENDING_PAYMENT),
              ),
            );
        }
        if (
          task.status !== TASK_STATUS.IN_PROGRESS &&
          task.status !== TASK_STATUS.SUBMITTED
        ) {
          patch.status = TASK_STATUS.IN_PROGRESS;
        }
      } else if (isAncestor) {
        // 未进树：上级类任务锁定，不生成订单（商城付款进树后由 placePendingUser 解锁）
        await this.db
          .delete(consultOrders)
          .where(
            and(
              eq(consultOrders.taskId, task.id),
              eq(consultOrders.status, CONSULT_ORDER_STATUS.PENDING_PAYMENT),
            ),
          );
        if (task.targetId) patch.targetId = null;
        if (task.status !== TASK_STATUS.PENDING) patch.status = TASK_STATUS.PENDING;
      } else {
        // 未进树的直推（inviter）任务：与位置无关，保持可做
        if (
          !hasLiveOrder &&
          fixOwner?.inviterId &&
          fixOwner.inviterId !== task.targetId
        ) {
          patch.targetId = fixOwner.inviterId;
        }
        if (
          task.status !== TASK_STATUS.IN_PROGRESS &&
          task.status !== TASK_STATUS.SUBMITTED
        ) {
          patch.status = TASK_STATUS.IN_PROGRESS;
        }
      }

      if (Object.keys(patch).length > 0) {
        await this.db
          .update(upgradeTasks)
          .set(patch)
          .where(eq(upgradeTasks.id, task.id));
        taskRows[i] = { ...task, ...patch };
        this.logger.log(
          `buildCenterInfo fix idx=${task.taskIndex} inTree=${inTree} target=${patch.targetId !== undefined ? patch.targetId : task.targetId} status=${patch.status ?? task.status}`,
        );
      }
    }

    // 存量修正：进行中任务若已上传付款凭证（订单待审核），改为 submitted
    await this.reconcileSubmittedTasks(userId, taskRows);

    // 兜底自动放开：mall 与直推任务可直接放开；上级类仅在进树后放开
    for (let i = 0; i < taskRows.length; i++) {
      const currTask = taskRows[i];
      if (
        currTask.status !== TASK_STATUS.PENDING &&
        currTask.status !== UNAVAILABLE_STATUS
      ) {
        continue;
      }
      const fdef = defs.find((d) => d.taskIndex === currTask.taskIndex);
      let canAuto = false;
      if (currTask.taskType === TASK_TYPE.MALL_PURCHASE) {
        canAuto = true;
      } else if (fdef?.targetKind === 'inviter') {
        canAuto = true;
      } else {
        canAuto = inTree; // 上级类：仅进树后放开
      }
      if (canAuto) {
        await this.db
          .update(upgradeTasks)
          .set({ status: TASK_STATUS.IN_PROGRESS })
          .where(eq(upgradeTasks.id, currTask.id));
        taskRows[i] = { ...currTask, status: TASK_STATUS.IN_PROGRESS };
        this.logger.log(`Auto-started task idx=${currTask.taskIndex}`);
      }
    }

    const tasks: UpgradeTaskInfo[] = taskRows.map(
      (row: UpgradeTaskSelect): UpgradeTaskInfo =>
        this.mapTaskInfo(row),
    );

    return { currentLevel, nextLevel, tasks, treeLocked: !inTree };
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
    const ownerRows = await this.db
      .select({ isInvited: users.isInvited })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!ownerRows[0]?.isInvited) {
      throw new BadRequestException('您还未绑定邀请人，无法开始任务。请先到「任务中心」补充邀请码激活账号');
    }
    if (task.status === UNAVAILABLE_STATUS) {
      throw new BadRequestException('任务不可用（无目标上级）');
    }
    if (task.status !== TASK_STATUS.PENDING) {
      throw new BadRequestException('任务状态不允许开始');
    }

    // 上级类任务门禁：未进树（团队位置未锁定）不得开始
    const stageDef = (
      TASK_DEFINITIONS[`${task.fromLevel}->${task.toLevel}`] || []
    ).find((d) => d.taskIndex === task.taskIndex);
    if (stageDef?.targetKind.startsWith('ancestor_')) {
      const selfTeam = (
        await this.db
          .select()
          .from(teamRelations)
          .where(eq(teamRelations.userId, userId))
          .limit(1)
      )[0];
      if (!selfTeam?.path) {
        throw new BadRequestException(
          '请先完成「商城购买」任务并上传付款凭证，系统锁定团队位置后，该任务会自动解锁',
        );
      }
    }

    // 并行任务：不再要求前一任务完成/传凭证，任意任务都可直接开始

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

  /**
   * 扶正"生成时因邀请人/团队树尚未就绪而错误兜底给管理员"的未付款咨询任务。
   * 仅处理 target=管理员、且无审核中/已付款订单的任务，按当前团队关系重算收款人：
   *  - 能算到具体上级：删除残留的管理员未付款订单，改指正确收款人；
   *  - 仍无合格上级：保留管理员（属正常兜底）。
   * 已付款 / 已完成 / 审核中任务一律不动。
   */
  async reconcileAdminTargets(): Promise<{
    placed: number;
    placedDetail: string[];
    fixed: number;
    keptAdmin: number;
    locked: number;
    skipped: number;
    fixedDetail: string[];
    keptAdminDetail: string[];
    lockedDetail: string[];
  }> {
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    const fixedDetail: string[] = [];
    const keptAdminDetail: string[] = [];
    const lockedDetail: string[] = [];
    let skipped = 0;
    let placed = 0;
    const placedDetail: string[] = [];

    // Step 1: 已付商城款、应进树却没进树的用户，补放进树（幂等、并发安全，并校正 level_4 任务收款人）
    const invitedUsers = await this.db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .where(isNotNull(users.inviterId));
    const inTreeIds = new Set(
      (
        await this.db
          .select({ userId: teamRelations.userId })
          .from(teamRelations)
      ).map((r) => r.userId),
    );
    for (const cand of invitedUsers) {
      if (inTreeIds.has(cand.id)) continue;
      const m0rows = await this.db
        .select({ status: upgradeTasks.status })
        .from(upgradeTasks)
        .where(
          and(
            eq(upgradeTasks.userId, cand.id),
            eq(upgradeTasks.taskType, TASK_TYPE.MALL_PURCHASE),
            eq(upgradeTasks.taskIndex, 0),
          ),
        );
      const paid0 = m0rows.some(
        (t) =>
          t.status === TASK_STATUS.SUBMITTED ||
          t.status === TASK_STATUS.COMPLETED,
      );
      if (!paid0) continue;
      try {
        await this.usersService.placePendingUser(cand.id);
        placed += 1;
        placedDetail.push(cand.phone);
      } catch (e) {
        this.logger.error(`reconcile place failed: ${cand.phone} ${e}`);
      }
    }

    const adminTasks: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.targetId, ADMIN_ID),
          inArray(upgradeTasks.status, [
            TASK_STATUS.PENDING,
            TASK_STATUS.IN_PROGRESS,
          ]),
        ),
      );

    for (const task of adminTasks) {
      const stageKey = `${task.fromLevel}->${task.toLevel}`;
      const def = (TASK_DEFINITIONS[stageKey] || []).find(
        (d) => d.taskIndex === task.taskIndex,
      );
      if (!def || def.taskType !== TASK_TYPE.CONSULT_SERVICE) {
        skipped += 1;
        continue;
      }

      // 该任务若已有非"待付款"订单，说明钱已在途/审核中，不能扶正
      const existOrders = await this.db
        .select()
        .from(consultOrders)
        .where(eq(consultOrders.taskId, task.id));
      if (
        existOrders.some(
          (o) => o.status !== CONSULT_ORDER_STATUS.PENDING_PAYMENT,
        )
      ) {
        skipped += 1;
        continue;
      }

      const owner = (
        await this.db
          .select()
          .from(users)
          .where(eq(users.id, task.userId))
          .limit(1)
      )[0];
      const teamRow = (
        await this.db
          .select()
          .from(teamRelations)
          .where(eq(teamRelations.userId, task.userId))
          .limit(1)
      )[0];

      if (def.targetKind.startsWith('ancestor_') && !teamRow?.path) {
        // 未进树：上级类任务锁定（不生成订单），等商城付款进树后解锁
        await this.db
          .delete(consultOrders)
          .where(
            and(
              eq(consultOrders.taskId, task.id),
              eq(consultOrders.status, CONSULT_ORDER_STATUS.PENDING_PAYMENT),
            ),
          );
        await this.db
          .update(upgradeTasks)
          .set({ targetId: null, status: TASK_STATUS.PENDING })
          .where(eq(upgradeTasks.id, task.id));
        lockedDetail.push(`${owner?.phone ?? task.userId}:i${task.taskIndex}`);
        continue;
      }

      let expected: string | null = null;
      if (def.targetKind === 'inviter') {
        expected = owner?.inviterId ?? null;
      } else if (def.targetKind.startsWith('ancestor_')) {
        const depth = Number(def.targetKind.slice('ancestor_'.length));
        expected = this.getAncestorFromPath(teamRow?.path, depth);
      }

      if (expected && expected !== ADMIN_ID) {
        await this.db
          .delete(consultOrders)
          .where(
            and(
              eq(consultOrders.taskId, task.id),
              eq(consultOrders.consultantId, ADMIN_ID),
              eq(
                consultOrders.status,
                CONSULT_ORDER_STATUS.PENDING_PAYMENT,
              ),
            ),
          );
        await this.db
          .update(upgradeTasks)
          .set({ targetId: expected, status: TASK_STATUS.IN_PROGRESS })
          .where(eq(upgradeTasks.id, task.id));
        fixedDetail.push(
          `${owner?.phone ?? task.userId}:i${task.taskIndex}->${expected}`,
        );
      } else {
        keptAdminDetail.push(
          `${owner?.phone ?? task.userId}:i${task.taskIndex}`,
        );
      }
    }

    this.logger.log(
      `reconcileAdminTargets: placed=${placed}, fixed=${fixedDetail.length}, keptAdmin=${keptAdminDetail.length}, locked=${lockedDetail.length}, skipped=${skipped}`,
    );
    return {
      placed,
      placedDetail,
      fixed: fixedDetail.length,
      keptAdmin: keptAdminDetail.length,
      locked: lockedDetail.length,
      skipped,
      fixedDetail,
      keptAdminDetail,
      lockedDetail,
    };
  }

  /**
   * 临时修复方法：删除用户的所有升级任务，让系统重新生成
   * 用于修复之前因为没有邀请人导致targetId错误的问题
   */
  async resetUserTasks(userId: string): Promise<{ success: boolean; message: string }> {
    // 删除用户的所有升级任务
    const result = await this.db
      .delete(upgradeTasks)
      .where(eq(upgradeTasks.userId, userId));

    this.logger.log(`User ${userId} reset upgrade tasks, deleted ${result.count} rows`);

    return {
      success: true,
      message: `已删除 ${result.count} 条升级任务，下次访问任务中心时会重新生成`,
    };
  }

  /**
   * 管理员：清空全部用户的升级任务（规则大改后用于全量重新生成）
   */
  async resetAllTasks(): Promise<{ success: boolean; message: string }> {
    const result = await this.db.delete(upgradeTasks);
    this.logger.log(`Reset ALL upgrade tasks, deleted ${result.count} rows`);
    return {
      success: true,
      message: `已清空全部升级任务（${result.count} 条），将按新规则重新生成`,
    };
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
    // Find any pending/in-progress/submitted mall task for this user
    const inProgressTasks: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, userId),
          or(
            eq(upgradeTasks.status, TASK_STATUS.IN_PROGRESS),
            eq(upgradeTasks.status, TASK_STATUS.SUBMITTED),
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
          inArray(upgradeTasks.status, [
            TASK_STATUS.IN_PROGRESS,
            TASK_STATUS.SUBMITTED,
            TASK_STATUS.PENDING,
          ]),
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

  /**
   * 存量修正：IN_PROGRESS 任务若已上传付款凭证（订单进入待审核），改为 SUBMITTED
   * 直接修改传入的 taskRows（内存）与数据库
   */
  private async reconcileSubmittedTasks(
    userId: string,
    taskRows: UpgradeTaskSelect[],
  ): Promise<void> {
    const inProgress: UpgradeTaskSelect[] = taskRows.filter(
      (t) => t.status === TASK_STATUS.IN_PROGRESS,
    );
    if (inProgress.length === 0) return;

    const toSubmitIds = new Set<string>();

    // 商城任务：批量查已上传凭证的商城订单（待审核/待发货/待收货），金额匹配
    const mallTasks = inProgress.filter((t) => t.taskType === TASK_TYPE.MALL_PURCHASE);
    if (mallTasks.length > 0) {
      const mallOrderRows = await this.db
        .select()
        .from(mallOrders)
        .where(
          and(
            eq(mallOrders.userId, userId),
            inArray(mallOrders.status, [
              MALL_ORDER_STATUS.PENDING_REVIEW,
              MALL_ORDER_STATUS.PENDING_SHIPMENT,
              MALL_ORDER_STATUS.PENDING_DELIVERY,
            ]),
          ),
        );
      for (const t of mallTasks) {
        if (mallOrderRows.some((o) => Number(o.totalAmount) >= Number(t.amount))) {
          toSubmitIds.add(t.id);
        }
      }
    }

    // 咨询任务：批量查该批任务已上传凭证的咨询订单（待确认/服务中/待审核）
    const consultTasks = inProgress.filter((t) => t.taskType === TASK_TYPE.CONSULT_SERVICE);
    if (consultTasks.length > 0) {
      const consultTaskIds = consultTasks.map((t) => t.id);
      const consultOrderRows = await this.db
        .select()
        .from(consultOrders)
        .where(
          and(
            eq(consultOrders.studentId, userId),
            inArray(consultOrders.taskId, consultTaskIds),
            inArray(consultOrders.status, [
              CONSULT_ORDER_STATUS.PENDING_CONFIRM,
              CONSULT_ORDER_STATUS.IN_SERVICE,
              CONSULT_ORDER_STATUS.PENDING_REVIEW,
            ]),
          ),
        );
      const submittedTaskIds = new Set<string>(
        consultOrderRows.map((o) => o.taskId).filter((x): x is string => !!x),
      );
      for (const t of consultTasks) {
        if (submittedTaskIds.has(t.id)) toSubmitIds.add(t.id);
      }
    }

    for (let i = 0; i < taskRows.length; i++) {
      if (toSubmitIds.has(taskRows[i].id)) {
        await this.db
          .update(upgradeTasks)
          .set({ status: TASK_STATUS.SUBMITTED })
          .where(eq(upgradeTasks.id, taskRows[i].id));
        taskRows[i] = { ...taskRows[i], status: TASK_STATUS.SUBMITTED };
        this.logger.log(`Reconciled task to submitted: taskId=${taskRows[i].id}`);
      }
    }
  }

  /**
   * 实时：咨询订单上传付款凭证后调用（按 taskId）
   * 任务 IN_PROGRESS → SUBMITTED，并解锁下一任务
   */
  async markTaskSubmittedByTaskId(taskId: string | null | undefined): Promise<void> {
    if (!taskId) return;
    const task: UpgradeTaskSelect | undefined = (
      await this.db.select().from(upgradeTasks).where(eq(upgradeTasks.id, taskId)).limit(1)
    )[0];
    if (!task || task.status !== TASK_STATUS.IN_PROGRESS) return;
    await this.db
      .update(upgradeTasks)
      .set({ status: TASK_STATUS.SUBMITTED })
      .where(eq(upgradeTasks.id, task.id));
    this.logger.log(`Task marked submitted (consult): taskId=${task.id}`);
    await this.unlockNextTask({ ...task, status: TASK_STATUS.SUBMITTED });
  }

  /**
   * 实时：商城订单上传付款凭证后调用（金额匹配）
   * 匹配的 IN_PROGRESS mall_purchase 任务 → SUBMITTED，并解锁下一任务
   */
  async markMallTaskSubmitted(userId: string, totalAmount: string): Promise<void> {
    const tasks: UpgradeTaskSelect[] = await this.db
      .select()
      .from(upgradeTasks)
      .where(
        and(
          eq(upgradeTasks.userId, userId),
          eq(upgradeTasks.status, TASK_STATUS.IN_PROGRESS),
          eq(upgradeTasks.taskType, TASK_TYPE.MALL_PURCHASE),
        ),
      );
    for (const task of tasks) {
      if (Number(totalAmount) >= Number(task.amount)) {
        await this.db
          .update(upgradeTasks)
          .set({ status: TASK_STATUS.SUBMITTED })
          .where(eq(upgradeTasks.id, task.id));
        this.logger.log(`Task marked submitted (mall): taskId=${task.id}`);
        await this.unlockNextTask({ ...task, status: TASK_STATUS.SUBMITTED });
      }
    }

    // 首次商城付款（上传凭证）即"待位"进树；并发安全、幂等（已在树自动跳过）
    try {
      await this.usersService.placePendingUser(userId);
    } catch (e) {
      this.logger.error(`待位放位失败: ${e}`);
    }
  }

  /**
   * 解锁下一任务：当前阶段下一个 PENDING/unavailable 任务 → IN_PROGRESS
   */
  private async unlockNextTask(task: UpgradeTaskSelect): Promise<void> {
    const next: UpgradeTaskSelect | undefined = (
      await this.db
        .select()
        .from(upgradeTasks)
        .where(
          and(
            eq(upgradeTasks.userId, task.userId),
            eq(upgradeTasks.fromLevel, task.fromLevel),
            eq(upgradeTasks.toLevel, task.toLevel),
            eq(upgradeTasks.taskIndex, task.taskIndex + 1),
          ),
        )
        .limit(1)
    )[0];
    if (next && (next.status === TASK_STATUS.PENDING || next.status === UNAVAILABLE_STATUS)) {
      await this.db
        .update(upgradeTasks)
        .set({ status: TASK_STATUS.IN_PROGRESS })
        .where(eq(upgradeTasks.id, next.id));
      this.logger.log(`Unlocked next task: taskId=${next.id}, index=${next.taskIndex}`);
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

    const updateData: Record<string, any> = { level: toLevel };

    // Level 4 and above: generate invite code if not present
    const levelNum: number = LEVEL_ORDER.indexOf(toLevel);
    const isHighLevel: boolean = levelNum >= LEVEL_ORDER.indexOf(LEVELS.LEVEL_4);

    if (isHighLevel) {
      const code: string = await this.generateUniqueInviteCode();
      updateData.inviteCode = code;
    }

    // Level 7 and above: automatically become seller
    const isSellerLevel: boolean = levelNum >= LEVEL_ORDER.indexOf('level_7');
    if (isSellerLevel) {
      updateData.isSeller = true;
      updateData.sellerStatus = 'approved';
    }

    // 升级四星：直接成为正式四星（收自己的钱）；升级满7天且累计收入超900元后由定时任务启动考核
    if (toLevel === LEVELS.LEVEL_4) {
      updateData.fourStarAt = new Date();
      updateData.assessmentStatus = 'none';
    }

    await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    // 升级到4级时，将用户滑落进入团队树（注册时不占位置，完成4级任务后才进入）
    if (toLevel === LEVELS.LEVEL_4) {
      const userRow = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (userRow.length > 0 && userRow[0].inviterId) {
        await this.usersService.assignUserToTeamTree(userId, userRow[0].inviterId);
        // 成为有效直推：此时才给邀请人 direct_invite_count +1
        // （注册时不再提前 +1，避免 junior 直推虚高）
        await this.db
          .update(users)
          .set({ directInviteCount: sql`${users.directInviteCount} + 1` })
          .where(eq(users.id, userRow[0].inviterId));
      }
    }

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

  /**
   * 未绑定邀请人账号的强制清理：删除其全部已生成任务与未付款订单，
   * 保证"先绑定邀请人，绑定前不生成/不进行任何任务"。
   * 仅删除 pending_payment（用户未付款）订单，不动在途审核单，保证资金安全。
   */
  private async clearTasksForUnbound(userId: string): Promise<void> {
    await this.db.delete(mallOrders).where(
      and(eq(mallOrders.userId, userId), eq(mallOrders.status, 'pending_payment')),
    );
    await this.db.delete(consultOrders).where(
      and(eq(consultOrders.studentId, userId), eq(consultOrders.status, 'pending_payment')),
    );
    await this.db.delete(upgradeTasks).where(eq(upgradeTasks.userId, userId));
  }

  private async ensureTasks(
    userId: string,
    fromLevel: string,
    toLevel: string,
    defs: TaskDefinition[],
  ): Promise<void> {
    const gateUser: UserSelect | undefined = (
      await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    )[0];
    if (!gateUser?.isInvited) return;

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
      // 并行任务：同一级别所有任务一进来即可同时开始（无目标的咨询任务下方兜底给管理员）
      let status: string = TASK_STATUS.IN_PROGRESS;

      if (def.targetKind === 'mall') {
        targetId = null;
      } else if (def.targetKind === 'inviter') {
        targetId = user?.inviterId ?? null;
      } else if (def.targetKind.startsWith('ancestor_')) {
        const depth = Number(def.targetKind.slice('ancestor_'.length));
        if (teamRow?.path) {
          // 本人已进树（位置已锁定）：按真实 path 确定上级收款人
          targetId = this.getAncestorFromPath(teamRow.path, depth);
        } else {
          // 未进树：上级位置尚未锁定，暂不开放（进树后由 placePendingUser 解锁）
          status = TASK_STATUS.PENDING;
          targetId = null;
        }
      }

      // 已进树但确实到顶无上级：兜底管理员；未进树锁定的任务不兜底
      if (
        def.taskType === TASK_TYPE.CONSULT_SERVICE &&
        !targetId &&
        status === TASK_STATUS.IN_PROGRESS
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

  /**
   * 待位阶段（本人尚未进树）推算团队树 ancestor：
   *  depth1（直接上级）= 直推人本人；
   *  depth k(k>=2) = 直推人 path 的第 k-1 级上级。
   * 与 placePendingUser 进树后的真实 path 校正口径一致。
   */
  private getPendingAncestor(
    inviterPath: string | undefined,
    inviterId: string,
    depth: number,
  ): string | null {
    if (depth <= 1) return inviterId ?? null;
    return this.getAncestorFromPath(inviterPath, depth - 1);
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
