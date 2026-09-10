import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, sql, like, inArray } from 'drizzle-orm';

import type {
  InviteInfo,
  InviteRecordInfo,
  TeamInfo,
  TeamTreeNode,
} from '@shared/api.interface';
import { LEVEL_LAYERS } from '@shared/api.interface';
import {
  inviteRecords,
  teamRelations,
  users,
} from '@server/database/schema';
import { generateInviteCode } from '@server/common/utils/auth.util';

type UserSelect = typeof users.$inferSelect;

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ── Team Tree ──────────────────────────────────────────────────

  async getTeamTree(userId: string, isInvited: boolean): Promise<TeamInfo> {
    // 查询当前用户基本信息
    const currentUsers: Pick<UserSelect, 'id' | 'nickname' | 'avatarUrl' | 'level' | 'directInviteCount' | 'teamTotalCount'>[] =
      await this.db
        .select({
          id: users.id,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          level: users.level,
          directInviteCount: users.directInviteCount,
          teamTotalCount: users.teamTotalCount,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (currentUsers.length === 0) {
      throw new ForbiddenException('用户不存在');
    }
    const currentUser = currentUsers[0];

    // 通过 team_relations 的 path 字段一次性查出所有下级
    // path 格式：",uuid1,uuid2,uuid3,"，用 LIKE '%,userId,%' 匹配所有后代
    const pathPattern = `%,${userId},%`;
    const descendantRelations = await this.db
      .select({
        userId: teamRelations.userId,
        parentId: teamRelations.parentId,
        treeLevel: teamRelations.treeLevel,
      })
      .from(teamRelations)
      .where(like(teamRelations.path, pathPattern));

    if (descendantRelations.length === 0) {
      return {
        tree: {
          userId: currentUser.id,
          nickname: currentUser.nickname,
          avatarUrl: currentUser.avatarUrl ?? undefined,
          level: currentUser.level,
          children: [],
        },
        directInviteCount: currentUser.directInviteCount,
        teamTotalCount: currentUser.teamTotalCount,
      };
    }

    // 一次性查出所有下级用户的信息（避免 N+1）
    const descendantUserIds: string[] = descendantRelations.map(
      (r: { userId: string; parentId: string | null; treeLevel: number }) => r.userId,
    );
    const descendantUsers: Pick<UserSelect, 'id' | 'nickname' | 'avatarUrl' | 'level'>[] =
      await this.db
        .select({
          id: users.id,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          level: users.level,
        })
        .from(users)
        .where(inArray(users.id, descendantUserIds));

    const userInfoMap = new Map<string, Pick<UserSelect, 'id' | 'nickname' | 'avatarUrl' | 'level'>>();
    for (const u of descendantUsers) {
      userInfoMap.set(u.id, u);
    }

    // 按 parentId 分组
    const childrenByParent = new Map<string, string[]>();
    for (const r of descendantRelations) {
      const parentId = r.parentId;
      if (!parentId) continue;
      const existing = childrenByParent.get(parentId) ?? [];
      existing.push(r.userId);
      childrenByParent.set(parentId, existing);
    }

    // 递归构建树
    const buildTree = (nodeUserId: string): TeamTreeNode => {
      const info = userInfoMap.get(nodeUserId);
      const childIds = childrenByParent.get(nodeUserId) ?? [];
      const children: TeamTreeNode[] = childIds.map((cid: string) => buildTree(cid));

      if (nodeUserId === currentUser.id) {
        return {
          userId: currentUser.id,
          nickname: currentUser.nickname,
          avatarUrl: currentUser.avatarUrl ?? undefined,
          level: currentUser.level,
          children,
        };
      }

      return {
        userId: nodeUserId,
        nickname: info?.nickname ?? '未知用户',
        avatarUrl: info?.avatarUrl ?? undefined,
        level: info?.level ?? 'junior',
        children,
      };
    };

    const tree = buildTree(currentUser.id);

    return {
      tree,
      directInviteCount: currentUser.directInviteCount,
      teamTotalCount: currentUser.teamTotalCount,
    };
  }

  // ── Invite Info ────────────────────────────────────────────────

  async getInviteInfo(userId: string, userLevel: string): Promise<InviteInfo> {
    // 从数据库查询用户最新级别（避免token中级别未更新导致4级用户无法生成邀请码）
    const currentUsers: Pick<UserSelect, 'id' | 'inviteCode' | 'level'>[] = await this.db
      .select({
        id: users.id,
        inviteCode: users.inviteCode,
        level: users.level,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (currentUsers.length === 0) {
      throw new BadRequestException('用户不存在');
    }

    const latestLevel = currentUsers[0].level;
    const layer = LEVEL_LAYERS[latestLevel] ?? 0;
    if (layer < 4) {
      throw new BadRequestException('仅4级及以上咨询师拥有邀请码，请先升级');
    }

    let inviteCode = currentUsers[0].inviteCode;

    // 没有邀请码则自动生成
    if (!inviteCode) {
      inviteCode = await this.generateAndSaveInviteCode(userId);
    }

    // 查询邀请记录
    const records = await this.db
      .select({
        id: inviteRecords.id,
        inviterId: inviteRecords.inviterId,
        inviteeId: inviteRecords.inviteeId,
        inviteCode: inviteRecords.inviteCode,
        registeredAt: inviteRecords.registeredAt,
      })
      .from(inviteRecords)
      .where(eq(inviteRecords.inviterId, userId))
      .orderBy(sql`${inviteRecords.registeredAt} DESC`);

    // 批量查询被邀请人信息（避免 N+1）
    let inviteeList: Pick<UserSelect, 'id' | 'nickname' | 'avatarUrl' | 'phone' | 'level'>[] = [];
    if (records.length > 0) {
      const inviteeIds: string[] = records.map((r: { inviteeId: string }) => r.inviteeId);
      inviteeList = await this.db
        .select({
          id: users.id,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          phone: users.phone,
          level: users.level,
        })
        .from(users)
        .where(inArray(users.id, inviteeIds));
    }

    const inviteeMap = new Map<string, Pick<UserSelect, 'id' | 'nickname' | 'avatarUrl' | 'phone' | 'level'>>();
    for (const u of inviteeList) {
      inviteeMap.set(u.id, u);
    }

    const recordList: InviteRecordInfo[] = records.map((r) => {
      const invitee = inviteeMap.get(r.inviteeId);
      return {
        id: r.id,
        inviterId: r.inviterId,
        inviteeId: r.inviteeId,
        invitee: invitee
          ? {
              nickname: invitee.nickname,
              avatarUrl: invitee.avatarUrl ?? undefined,
              phone: invitee.phone,
              level: invitee.level,
            }
          : undefined,
        inviteCode: r.inviteCode,
        registeredAt: r.registeredAt.toISOString(),
      };
    });

    return {
      inviteCode,
      records: recordList,
      total: records.length,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async generateAndSaveInviteCode(userId: string): Promise<string> {
    let code = generateInviteCode(8);
    let attempts = 0;
    while (attempts < 5) {
      try {
        const updated = await this.db
          .update(users)
          .set({ inviteCode: code })
          .where(eq(users.id, userId))
          .returning({ inviteCode: users.inviteCode });
        if (updated.length > 0 && updated[0].inviteCode) {
          return updated[0].inviteCode;
        }
        break;
      } catch {
        // 唯一约束冲突，换一个重试
        code = generateInviteCode(6);
        attempts += 1;
      }
    }
    throw new ConflictException('生成邀请码失败，请稍后重试');
  }
}
