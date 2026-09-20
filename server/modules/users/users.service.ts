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
import { users, teamRelations, inviteRecords, upgradeTasks } from '@server/database/schema';
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
    const userInfo = this.toUserInfo(result);
    if (inviter) {
      userInfo.inviterNickname = inviter.nickname;
      userInfo.inviterPhone = inviter.phone;
    }
    return { token, user: userInfo };
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
    const userInfo = this.toUserInfo(user);
    // 关联查询邀请人信息
    if (user.inviterId) {
      const inviterRows = await this.db
        .select({ nickname: users.nickname, phone: users.phone })
        .from(users)
        .where(eq(users.id, user.inviterId))
        .limit(1);
      if (inviterRows.length > 0) {
        userInfo.inviterNickname = inviterRows[0].nickname;
        userInfo.inviterPhone = inviterRows[0].phone;
      }
    }
    return { token, user: userInfo };
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

    let user = userRows[0];

    // 自动解除900元门槛限制：直推人数达到3人及以上，或升级到5级及以上时自动解除
    if (user.thresholdBlocked && (user.directInviteCount >= 3 || user.level !== 'level_4')) {
      const pendingAmount = Number(user.pendingReclaimAmount) || 0;
      const incomeNum = Number(user.totalConsultIncome) || 0;
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
        `用户登录时自动解除900元门槛: userId=${userId}, level=${user.level}, ` +
          `directInviteCount=${user.directInviteCount}, ` +
          `返还暂存金额=${pendingAmount}`,
      );
      // 重新查询用户信息
      const refreshedRows = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (refreshedRows.length > 0) {
        user = refreshedRows[0];
      }
    }

    const userInfo = this.toUserInfo(user);

    // 关联查询邀请人信息
    if (user.inviterId) {
      const inviterRows = await this.db
        .select({ nickname: users.nickname, phone: users.phone })
        .from(users)
        .where(eq(users.id, user.inviterId))
        .limit(1);
      if (inviterRows.length > 0) {
        userInfo.inviterNickname = inviterRows[0].nickname;
        userInfo.inviterPhone = inviterRows[0].phone;
      }
    }

    return userInfo;
  }

  // 获取用户关系树（上级+下级）
  async getRelationTree(userId: string): Promise<{
    // 上级关系
    directInviter: { id: string; nickname: string; phone: string; level: string } | null;
    directParent: { id: string; nickname: string; phone: string; level: string } | null;
    // 下级关系（可能有多个）
    directChildren: Array<{ id: string; nickname: string; phone: string; level: string }>;
    secondGenerationChildren: Array<{ id: string; nickname: string; phone: string; level: string }>;
    thirdGenerationChildren: Array<{ id: string; nickname: string; phone: string; level: string }>;
  }> {
    const userRows = await this.db
      .select({ inviterId: users.inviterId, parentId: users.parentId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = userRows[0];
    const result = {
      directInviter: null,
      directParent: null,
      directChildren: [],
      secondGenerationChildren: [],
      thirdGenerationChildren: [],
    };

    // 辅助函数：根据ID获取用户简要信息
    const getUserBrief = async (id: string | null) => {
      if (!id) return null;
      const rows = await this.db
        .select({ id: users.id, nickname: users.nickname, phone: users.phone, level: users.level })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return rows.length > 0 ? rows[0] : null;
    };

    // 辅助函数：根据parentId获取所有下级用户
    const getChildrenByParentId = async (parentId: string) => {
      const rows = await this.db
        .select({ id: users.id, nickname: users.nickname, phone: users.phone, level: users.level })
        .from(users)
        .where(eq(users.parentId, parentId));
      return rows;
    };

    // ===== 上级关系 =====
    // a. 我的直接邀请人
    result.directInviter = await getUserBrief(user.inviterId);

    // b. 我的直接上级咨询师（上一代）
    result.directParent = await getUserBrief(user.parentId);

    // ===== 下级关系 =====
    // c. 我的直接下一代咨询师
    const directChildren = await getChildrenByParentId(userId);
    result.directChildren = directChildren;

    // d. 我的下二代咨询师
    if (directChildren.length > 0) {
      const directChildIds = directChildren.map(c => c.id);
      const secondGenChildren = [];
      for (const childId of directChildIds) {
        const children = await getChildrenByParentId(childId);
        secondGenChildren.push(...children);
      }
      result.secondGenerationChildren = secondGenChildren;

      // e. 我的下三代咨询师
      if (secondGenChildren.length > 0) {
        const secondGenChildIds = secondGenChildren.map(c => c.id);
        const thirdGenChildren = [];
        for (const childId of secondGenChildIds) {
          const children = await getChildrenByParentId(childId);
          thirdGenChildren.push(...children);
        }
        result.thirdGenerationChildren = thirdGenChildren;
      }
    }

    return result;
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
    if (dto.address !== undefined) patch.address = dto.address;

    // 身份证号处理：格式校验、唯一性检查、自动判断性别
    if (dto.idCardNumber !== undefined && dto.idCardNumber.trim() !== '') {
      const idCard = dto.idCardNumber.trim().toUpperCase();
      // 身份证号格式校验（18位，最后一位可以是X）
      if (!/^\d{17}[\dX]$/.test(idCard)) {
        throw new BadRequestException('身份证号格式不正确，必须是18位数字');
      }
      // 唯一性检查（排除当前用户）
      const existing = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.idCardNumber, idCard))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== userId) {
        throw new ConflictException('该身份证号已被其他用户使用');
      }
      patch.idCardNumber = idCard;
      // 根据身份证号自动判断性别（第17位，奇数为男，偶数为女）
      const genderDigit = parseInt(idCard.charAt(16), 10);
      if (!isNaN(genderDigit)) {
        patch.gender = genderDigit % 2 === 1 ? '男' : '女';
      }
    }

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

      // 删除已生成的升级任务（因为之前没有邀请人，targetId可能是管理员）
      // 用户下次访问任务中心时会重新生成正确的任务
      await tx
        .delete(upgradeTasks)
        .where(eq(upgradeTasks.userId, user.id));

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
      idCardNumber: user.idCardNumber ?? undefined,
      realName: user.realName ?? undefined,
      address: user.address ?? undefined,
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
