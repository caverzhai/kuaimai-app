import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';

import type {
  LoginResponse,
  SupplementInviterDTO,
  UpdateProfileDTO,
  UserInfo,
  UserLoginDTO,
  UserRegisterDTO,
} from '@shared/api.interface';
import { LEVELS } from '@shared/api.interface';
import { users, teamRelations, inviteRecords } from '@server/database/schema';
import {
  generateInviteCode,
  generateToken,
  hashPassword,
  verifyPassword,
} from '@server/common/utils/auth.util';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type UserSelect = typeof users.$inferSelect;
type TeamRelationSelect = typeof teamRelations.$inferSelect;

const MAX_DIRECT_CHILDREN = 3;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ── Registration ──────────────────────────────────────────────

  async register(dto: UserRegisterDTO): Promise<LoginResponse> {
    // 0. 校验手机号格式（11位数字）
    if (!/^1\d{10}$/.test(dto.phone)) {
      throw new BadRequestException('手机号格式不正确，必须是11位数字');
    }

    // 1. 校验手机号唯一性
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('手机号已注册');
    }

    // 1.5 校验昵称唯一性
    const existingNickname = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.nickname, dto.nickname))
      .limit(1);
    if (existingNickname.length > 0) {
      throw new ConflictException('昵称已被使用，请换一个昵称');
    }

    // 2. 查找邀请人（如果有邀请码）
    let inviter: UserSelect | null = null;
    if (dto.inviteCode) {
      const inviterRows = await this.db
        .select()
        .from(users)
        .where(eq(users.inviteCode, dto.inviteCode))
        .limit(1);
      if (inviterRows.length === 0) {
        throw new BadRequestException('邀请码无效');
      }
      inviter = inviterRows[0];
    }

    const hashedPassword = hashPassword(dto.password);
    const inviteCode = generateInviteCode(8);

    // 3. 事务：创建用户 + 团队关系 + 更新计数
    const result = await this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          phone: dto.phone,
          nickname: dto.nickname,
          password: hashedPassword,
          avatarUrl: dto.avatarUrl,
          level: LEVELS.JUNIOR,
          isInvited: !!inviter,
          inviterId: inviter?.id,
          inviteCode,
        })
        .returning();

      if (inviter) {
        // BFS 找滑落位置
        const { parentId, parentRelation } = await this.findParentForSliding(
          tx,
          inviter.id,
        );

        // 计算 treeLevel 和 path
        const treeLevel = parentRelation ? parentRelation.treeLevel + 1 : 1;
        const basePath = parentRelation?.path ?? `,${inviter.id},`;
        const path = `${basePath}${newUser.id},`;

        // 计算 position（该 parent 已有几个孩子）
        const childCount = await tx
          .select({ count: sql<number>`count(*)` })
          .from(teamRelations)
          .where(eq(teamRelations.parentId, parentId));
        const position = Number(childCount[0]?.count ?? 0);

        // 写入 team_relations
        await tx.insert(teamRelations).values({
          userId: newUser.id,
          parentId,
          inviterId: inviter.id,
          treeLevel,
          path,
          position,
        });

        // 更新 users 表的 parentId 和 treeLevel
        await tx
          .update(users)
          .set({ parentId, treeLevel })
          .where(eq(users.id, newUser.id));

        // 邀请人 direct_invite_count +1
        await tx
          .update(users)
          .set({
            directInviteCount: sql`${users.directInviteCount} + 1`,
          })
          .where(eq(users.id, inviter.id));

        // 路径上所有人 team_total_count +1（排除自己）
        const ancestorIds = path
          .split(',')
          .filter((s: string) => s.length > 0 && s !== newUser.id);
        if (ancestorIds.length > 0) {
          await tx
            .update(users)
            .set({
              teamTotalCount: sql`${users.teamTotalCount} + 1`,
            })
            .where(sql`${users.id} = ANY(ARRAY[${sql.join(
              ancestorIds.map((id: string) => sql`${id}::uuid`),
              sql`, `,
            )}]::uuid[])`);
        }

        // 写入 invite_records
        await tx.insert(inviteRecords).values({
          inviterId: inviter.id,
          inviteeId: newUser.id,
          inviteCode: dto.inviteCode!,
        });

        // 重新查询完整用户信息
        const [updatedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, newUser.id))
          .limit(1);
        return updatedUser;
      }

      return newUser;
    });

    const token = this.makeToken(result);
    return { token, user: this.toUserInfo(result) };
  }

  // ── Login ─────────────────────────────────────────────────────

  async login(dto: UserLoginDTO): Promise<LoginResponse> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1);

    if (userRows.length === 0) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const user = userRows[0];
    if (!verifyPassword(dto.password, user.password)) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const token = this.makeToken(user);
    return { token, user: this.toUserInfo(user) };
  }

  // ── Current user ──────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<UserInfo> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.toUserInfo(userRows[0]);
  }

  // ── Update profile ────────────────────────────────────────────

  async updateProfile(
    userId: string,
    dto: UpdateProfileDTO,
  ): Promise<UserInfo> {
    const patch: Partial<typeof users.$inferInsert> = {};

    if (dto.nickname !== undefined) patch.nickname = dto.nickname;
    if (dto.avatarUrl !== undefined) patch.avatarUrl = dto.avatarUrl;
    if (dto.gender !== undefined) patch.gender = dto.gender;
    if (dto.age !== undefined) patch.age = dto.age;
    if (dto.receiveAddress !== undefined) patch.receiveAddress = dto.receiveAddress;
    if (dto.receivePhone !== undefined) patch.receivePhone = dto.receivePhone;
    if (dto.industry !== undefined) patch.industry = dto.industry;
    if (dto.qualification !== undefined) patch.qualification = dto.qualification;
    if (dto.serviceStandard !== undefined) patch.serviceStandard = dto.serviceStandard;
    if (dto.wechatQrcodeUrl !== undefined) patch.wechatQrcodeUrl = dto.wechatQrcodeUrl;
    if (dto.alipayQrcodeUrl !== undefined) patch.alipayQrcodeUrl = dto.alipayQrcodeUrl;
    if (dto.companyQrcodeUrl !== undefined) patch.companyQrcodeUrl = dto.companyQrcodeUrl;
    if (dto.businessLicenseUrl !== undefined) patch.businessLicenseUrl = dto.businessLicenseUrl;
    if (dto.idCardFrontUrl !== undefined) patch.idCardFrontUrl = dto.idCardFrontUrl;
    if (dto.idCardBackUrl !== undefined) patch.idCardBackUrl = dto.idCardBackUrl;
    if (dto.realName !== undefined) patch.realName = dto.realName;
    if (dto.wechatId !== undefined) patch.wechatId = dto.wechatId;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    // 提交了企业相关资料，设置为待审核
    if (dto.companyQrcodeUrl !== undefined || dto.businessLicenseUrl !== undefined) {
      patch.companyAuditStatus = 'pending';
    }

    const updated = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.toUserInfo(updated[0]);
  }

  // ── Supplement inviter ────────────────────────────────────────

  async supplementInviter(
    userId: string,
    dto: SupplementInviterDTO,
  ): Promise<UserInfo> {
    // 查找当前用户
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }
    const user = userRows[0];

    if (user.isInvited) {
      throw new BadRequestException('您已经有邀请人，无需补充');
    }

    // 查找邀请人
    const inviterRows = await this.db
      .select()
      .from(users)
      .where(eq(users.inviteCode, dto.inviteCode))
      .limit(1);
    if (inviterRows.length === 0) {
      throw new BadRequestException('邀请码无效');
    }
    const inviter = inviterRows[0];

    if (inviter.id === userId) {
      throw new BadRequestException('不能使用自己的邀请码');
    }

    const result = await this.db.transaction(async (tx) => {
      // BFS 找滑落位置
      const { parentId, parentRelation } = await this.findParentForSliding(
        tx,
        inviter.id,
      );

      const treeLevel = parentRelation ? parentRelation.treeLevel + 1 : 1;
      const basePath = parentRelation?.path ?? `,${inviter.id},`;
      const path = `${basePath}${user.id},`;

      const childCount = await tx
        .select({ count: sql<number>`count(*)` })
        .from(teamRelations)
        .where(eq(teamRelations.parentId, parentId));
      const position = Number(childCount[0]?.count ?? 0);

      // 写入 team_relations
      await tx.insert(teamRelations).values({
        userId: user.id,
        parentId,
        inviterId: inviter.id,
        treeLevel,
        path,
        position,
      });

      // 更新用户信息
      await tx
        .update(users)
        .set({
          isInvited: true,
          inviterId: inviter.id,
          parentId,
          treeLevel,
        })
        .where(eq(users.id, user.id));

      // 邀请人 direct_invite_count +1
      await tx
        .update(users)
        .set({
          directInviteCount: sql`${users.directInviteCount} + 1`,
        })
        .where(eq(users.id, inviter.id));

      // 路径上所有人 team_total_count +1
      const ancestorIds = path
        .split(',')
        .filter((s: string) => s.length > 0 && s !== user.id);
      if (ancestorIds.length > 0) {
        await tx
          .update(users)
          .set({
            teamTotalCount: sql`${users.teamTotalCount} + 1`,
          })
          .where(sql`${users.id} = ANY(ARRAY[${sql.join(
            ancestorIds.map((id: string) => sql`${id}::uuid`),
            sql`, `,
          )}]::uuid[])`);
      }

      // 写入 invite_records
      await tx.insert(inviteRecords).values({
        inviterId: inviter.id,
        inviteeId: user.id,
        inviteCode: dto.inviteCode,
      });

      const [updatedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      return updatedUser;
    });

    return this.toUserInfo(result);
  }

  // ── Invite code (get or generate) ─────────────────────────────

  async getOrGenerateInviteCode(userId: string): Promise<{ inviteCode: string }> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = userRows[0];
    const levelLayer = this.getLevelLayer(user.level);
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';

    // 管理员（零号线）和4级及以上咨询师可以生成邀请码
    if (levelLayer < 4 && user.id !== ADMIN_ID) {
      throw new BadRequestException('仅4级及以上咨询师可生成邀请码');
    }

    if (user.inviteCode) {
      return { inviteCode: user.inviteCode };
    }

    // 生成并保存邀请码（带冲突重试）
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      try {
        const updated = await this.db
          .update(users)
          .set({ inviteCode })
          .where(eq(users.id, userId))
          .returning({ inviteCode: users.inviteCode });
        if (updated.length > 0 && updated[0].inviteCode) {
          return { inviteCode: updated[0].inviteCode };
        }
        break;
      } catch {
        // 可能是唯一约束冲突，换一个重试
        inviteCode = generateInviteCode();
        attempts += 1;
      }
    }

    throw new ConflictException('生成邀请码失败，请稍后重试');
  }

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * BFS 团队树滑落：从邀请人开始，逐层找到第一个直接下级不足 3 人的节点
   */
  private async findParentForSliding(
    tx: PostgresJsDatabase,
    inviterId: string,
  ): Promise<{ parentId: string; parentRelation: TeamRelationSelect | null }> {
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

      if (children.length < MAX_DIRECT_CHILDREN) {
        // 查找当前节点的 team_relations 记录（用于 path 和 treeLevel）
        const relationRows = await tx
          .select()
          .from(teamRelations)
          .where(eq(teamRelations.userId, currentId))
          .limit(1);
        return {
          parentId: currentId,
          parentRelation: relationRows[0] ?? null,
        };
      }

      // 按 position 排序加入队列，保证从左到右滑落
      const sortedChildren = [...children].sort(
        (a: TeamRelationSelect, b: TeamRelationSelect) => a.position - b.position,
      );
      for (const child of sortedChildren) {
        queue.push(child.userId);
      }
    }

    // 理论上不会到这里（3 叉树指数增长，队列很快会遇到空位）
    this.logger.warn(`BFS sliding fallback to inviter: ${inviterId}`);
    return { parentId: inviterId, parentRelation: null };
  }

  private makeToken(user: UserSelect): string {
    return generateToken({
      userId: user.id,
      phone: user.phone,
      level: user.level,
      isInvited: user.isInvited,
    });
  }

  private getLevelLayer(level: string): number {
    const layerMap: Record<string, number> = {
      [LEVELS.JUNIOR]: 0,
      [LEVELS.LEVEL_4]: 4,
      [LEVELS.LEVEL_5]: 5,
      [LEVELS.LEVEL_6]: 6,
      [LEVELS.LEVEL_7]: 7,
      [LEVELS.LEVEL_8]: 8,
    };
    return layerMap[level] ?? 0;
  }

  private toUserInfo(user: UserSelect): UserInfo {
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? undefined,
      gender: user.gender ?? undefined,
      age: user.age ?? undefined,
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
      idCardFrontUrl: user.idCardFrontUrl ?? undefined,
      idCardBackUrl: user.idCardBackUrl ?? undefined,
      realName: user.realName ?? undefined,
      wechatId: user.wechatId ?? undefined,
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
}
