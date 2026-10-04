import {
  Inject,
  Injectable,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  eq,
  and,
  like,
  inArray,
  isNotNull,
  gte,
  desc,
} from 'drizzle-orm';

import {
  users,
  teamRelations,
  consultOrders,
  mallOrders,
} from '@server/database/schema';

const r2 = (n: number): number => Math.round(n * 100) / 100;

// 按 UTC+8 取日期键 YYYY-MM-DD
function dayKey(d: Date): string {
  const shifted = new Date(d.getTime() + 8 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export interface IncomeDay {
  date: string;
  consult: number;
  mall: number;
  total: number;
}

export interface IncomeStats {
  totalConsult: number;
  totalMall: number;
  total: number;
  daily: IncomeDay[];
}

export interface DownlineMember {
  userId: string;
  nickname: string;
  phone: string;
  avatarUrl?: string;
  level: string;
  directInviteCount: number;
  teamCount: number;
  totalIncome: number; // 个人实际到账总收入
  teamIncome: number; // 其整棵团队（含本人）实际到账总收入
}

export interface DownlineSelf {
  userId: string;
  totalIncome: number; // 我个人实际到账总收入
  teamIncome: number; // 我整棵团队（含本人）实际到账总收入
}

export interface DownlineLevel {
  depth: number;
  members: DownlineMember[];
}

export interface RecentConsultItem {
  orderNo: string;
  amount: number;
  confirmedAt: string;
  payerPhone: string;
  payerNickname: string;
  payerLevel: string;
  screenshotUrl?: string;
}

@Injectable()
export class StatsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ── 收入日统计：以实际确认到账（paymentConfirmedAt）为准，商城/咨询分开 ──
  async getIncomeStats(userId: string): Promise<IncomeStats> {
    const consultRows: { amount: string; at: Date | null }[] = await this.db
      .select({
        amount: consultOrders.amount,
        at: consultOrders.paymentConfirmedAt,
      })
      .from(consultOrders)
      .where(
        and(
          eq(consultOrders.consultantId, userId),
          isNotNull(consultOrders.paymentConfirmedAt),
        ),
      );

    const mallRows: { totalAmount: string; at: Date | null }[] = await this.db
      .select({
        totalAmount: mallOrders.totalAmount,
        at: mallOrders.paymentConfirmedAt,
      })
      .from(mallOrders)
      .where(
        and(
          eq(mallOrders.sellerId, userId),
          isNotNull(mallOrders.paymentConfirmedAt),
        ),
      );

    const map = new Map<string, IncomeDay>();
    let totalConsult = 0;
    let totalMall = 0;

    const ensure = (key: string): IncomeDay => {
      let cur = map.get(key);
      if (!cur) {
        cur = { date: key, consult: 0, mall: 0, total: 0 };
        map.set(key, cur);
      }
      return cur;
    };

    for (const r of consultRows) {
      if (!r.at) continue;
      const key = dayKey(r.at);
      const v = parseFloat(r.amount) || 0;
      const cur = ensure(key);
      cur.consult = r2(cur.consult + v);
      cur.total = r2(cur.total + v);
      totalConsult += v;
    }
    for (const r of mallRows) {
      if (!r.at) continue;
      const key = dayKey(r.at);
      const v = parseFloat(r.totalAmount) || 0;
      const cur = ensure(key);
      cur.mall = r2(cur.mall + v);
      cur.total = r2(cur.total + v);
      totalMall += v;
    }

    const daily = Array.from(map.values())
      .filter((d) => d.total > 0) // 零元当天不入表
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // 日期倒序

    return {
      totalConsult: r2(totalConsult),
      totalMall: r2(totalMall),
      total: r2(totalConsult + totalMall),
      daily,
    };
  }

  // ── 树下 levels 层会员详情：直邀人数、团队人数、个人/团队总收入 ──
  async getDownlineDetails(
    userId: string,
    levels: number,
  ): Promise<{ levels: DownlineLevel[]; self: DownlineSelf }> {
    const myRows: { treeLevel: number }[] = await this.db
      .select({ treeLevel: teamRelations.treeLevel })
      .from(teamRelations)
      .where(eq(teamRelations.userId, userId))
      .limit(1);
    const myTreeLevel = myRows[0]?.treeLevel ?? 0;

    // 一次性取我整棵树的关系（含 path/inviter），JS 内计算，避免 N+1
    const allRel: {
      userId: string;
      inviterId: string | null;
      treeLevel: number;
      path: string;
    }[] = await this.db
      .select({
        userId: teamRelations.userId,
        inviterId: teamRelations.inviterId,
        treeLevel: teamRelations.treeLevel,
        path: teamRelations.path,
      })
      .from(teamRelations)
      .where(like(teamRelations.path, `%,${userId},%`));

    const memberRels = allRel.filter((r) => {
      if (r.userId === userId) return false;
      const depth = r.treeLevel - myTreeLevel;
      return depth >= 1 && depth <= levels;
    });
    const memberIds = memberRels.map((r) => r.userId);

    // 整棵树涉及的用户信息（用于有效性判断与展示）
    const allUserIds = Array.from(new Set(allRel.map((r) => r.userId)));
    const userRows: {
      id: string;
      nickname: string;
      phone: string;
      avatarUrl: string | null;
      level: string;
      assessmentStatus: string | null;
    }[] =
      allUserIds.length > 0
        ? await this.db
            .select({
              id: users.id,
              nickname: users.nickname,
              phone: users.phone,
              avatarUrl: users.avatarUrl,
              level: users.level,
              assessmentStatus: users.assessmentStatus,
            })
            .from(users)
            .where(inArray(users.id, allUserIds))
        : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    const isEffective = (id: string): boolean => {
      const u = userMap.get(id);
      if (!u) return false;
      if (u.level === 'junior') return false;
      if (u.assessmentStatus === 'eliminated') return false;
      return true;
    };

    // 整棵树（含本人、任意深度）实际到账收入聚合
    const incomeMap = new Map<string, number>();
    const addIncome = (id: string | null, v: number) => {
      if (!id) return;
      incomeMap.set(id, r2((incomeMap.get(id) ?? 0) + v));
    };
    if (allUserIds.length > 0) {
      const cRows: { consultantId: string; amount: string }[] = await this.db
        .select({
          consultantId: consultOrders.consultantId,
          amount: consultOrders.amount,
        })
        .from(consultOrders)
        .where(
          and(
            inArray(consultOrders.consultantId, allUserIds),
            isNotNull(consultOrders.paymentConfirmedAt),
          ),
        );
      for (const c of cRows) addIncome(c.consultantId, parseFloat(c.amount) || 0);

      const mRows: { sellerId: string | null; totalAmount: string }[] =
        await this.db
          .select({
            sellerId: mallOrders.sellerId,
            totalAmount: mallOrders.totalAmount,
          })
          .from(mallOrders)
          .where(
            and(
              inArray(mallOrders.sellerId, allUserIds),
              isNotNull(mallOrders.paymentConfirmedAt),
            ),
          );
      for (const m of mRows) addIncome(m.sellerId, parseFloat(m.totalAmount) || 0);
    }

    // 团队总收入：路径在 id 之下（含 id 本人）的所有成员个人收入之和
    const teamIncomeOf = (id: string): number => {
      const key = `,${id},`;
      let sum = 0;
      for (const x of allRel) {
        if (x.path.includes(key)) sum += incomeMap.get(x.userId) ?? 0;
      }
      return r2(sum);
    };

    const buildMember = (r: (typeof memberRels)[number]): DownlineMember => {
      const u = userMap.get(r.userId);
      // 团队人数：其路径下的其他成员数
      const teamCount = allRel.filter(
        (x) => x.userId !== r.userId && x.path.includes(`,${r.userId},`),
      ).length;
      // 有效直邀：邀请人是该成员、且被邀请者有效
      const directInviteCount = allRel.filter(
        (x) => x.inviterId === r.userId && isEffective(x.userId),
      ).length;
      return {
        userId: r.userId,
        nickname: u?.nickname ?? '',
        phone: u?.phone ?? '',
        avatarUrl: u?.avatarUrl ?? undefined,
        level: u?.level ?? 'junior',
        directInviteCount,
        teamCount,
        totalIncome: incomeMap.get(r.userId) ?? 0,
        teamIncome: teamIncomeOf(r.userId),
      };
    };

    const out: DownlineLevel[] = [];
    for (let d = 1; d <= levels; d++) {
      const members = memberRels
        .filter((r) => r.treeLevel - myTreeLevel === d)
        .map(buildMember);
      out.push({ depth: d, members });
    }
    return {
      levels: out,
      self: {
        userId,
        totalIncome: incomeMap.get(userId) ?? 0,
        teamIncome: teamIncomeOf(userId),
      },
    };
  }

  // ── 最近 days 天咨询费收入明细：付款人账号/级别、支付截图 ──
  async getRecentConsult(
    userId: string,
    days: number,
  ): Promise<RecentConsultItem[]> {
    const since = new Date(Date.now() - days * 86400 * 1000);

    const rows: {
      orderNo: string;
      amount: string;
      confirmedAt: Date | null;
      screenshot: string | null;
      payerPhone: string | null;
      payerNickname: string | null;
      payerLevel: string | null;
    }[] = await this.db
      .select({
        orderNo: consultOrders.orderNo,
        amount: consultOrders.amount,
        confirmedAt: consultOrders.paymentConfirmedAt,
        screenshot: consultOrders.paymentScreenshotUrl,
        payerPhone: users.phone,
        payerNickname: users.nickname,
        payerLevel: users.level,
      })
      .from(consultOrders)
      .leftJoin(users, eq(consultOrders.studentId, users.id))
      .where(
        and(
          eq(consultOrders.consultantId, userId),
          isNotNull(consultOrders.paymentConfirmedAt),
          gte(consultOrders.paymentConfirmedAt, since),
        ),
      )
      .orderBy(desc(consultOrders.paymentConfirmedAt));

    return rows.map((r) => ({
      orderNo: r.orderNo,
      amount: r2(parseFloat(r.amount) || 0),
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : '',
      payerPhone: r.payerPhone ?? '',
      payerNickname: r.payerNickname ?? '',
      payerLevel: r.payerLevel ?? 'junior',
      screenshotUrl: r.screenshot ?? undefined,
    }));
  }
}
