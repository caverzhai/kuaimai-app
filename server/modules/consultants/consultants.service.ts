import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, ne, and, or, count, desc, asc, ilike, inArray, sql } from 'drizzle-orm';
import { users, industries, teamRelations } from '@server/database/schema';
import type {
  ConsultantInfo,
  ConsultantListQuery,
  ConsultantListResponse,
  IndustryInfo,
} from '@shared/api.interface';
import { LEVELS } from '@shared/api.interface';

@Injectable()
export class ConsultantsService {
  private readonly logger = new Logger(ConsultantsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /** 批量实时有效直推人数 */
  private async effectiveDirectMap(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};
    const rows = await this.db
      .select({ inviterId: users.inviterId, n: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(teamRelations, eq(teamRelations.userId, users.id))
      .where(
        and(
          inArray(users.inviterId, ids),
          sql`${users.level} <> 'junior' AND ${users.assessmentStatus} IS DISTINCT FROM 'eliminated'`,
        ),
      )
      .groupBy(users.inviterId);
    const map: Record<string, number> = {};
    for (const r of rows) map[r.inviterId] = r.n;
    return map;
  }

  async getConsultantList(query: ConsultantListQuery): Promise<ConsultantListResponse> {
    const page: number = query.page && query.page > 0 ? query.page : 1;
    const pageSize: number =
      query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const offset: number = (page - 1) * pageSize;

    // 管理员（零号线）即使是初级也显示在咨询师列表中
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    const conditions = [or(ne(users.level, LEVELS.JUNIOR), eq(users.id, ADMIN_ID))];

    if (query.industry) {
      conditions.push(eq(users.industry, query.industry));
    }

    if (query.level) {
      conditions.push(eq(users.level, query.level));
    }

    if (query.keyword) {
      conditions.push(ilike(users.nickname, `%${query.keyword}%`));
    }

    const whereClause = and(...conditions);

    const levelOrderSql = sql`CASE ${users.level}
      WHEN ${LEVELS.LEVEL_8} THEN 8
      WHEN ${LEVELS.LEVEL_7} THEN 7
      WHEN ${LEVELS.LEVEL_6} THEN 6
      WHEN ${LEVELS.LEVEL_5} THEN 5
      WHEN ${LEVELS.LEVEL_4} THEN 4
      ELSE 0
    END DESC`;

    const [countResult, itemsResult] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(users)
        .where(whereClause),
      this.db
        .select({
          id: users.id,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          level: users.level,
          industry: users.industry,
          qualification: users.qualification,
          serviceStandard: users.serviceStandard,
          directInviteCount: users.directInviteCount,
        })
        .from(users)
        .where(whereClause)
        .orderBy(levelOrderSql, desc(users.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total: number = Number(countResult[0]?.count ?? 0);

    const items: ConsultantInfo[] = itemsResult.map((row): ConsultantInfo => ({
      id: row.id,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl ?? undefined,
      level: row.level,
      industry: row.industry ?? undefined,
      qualification: row.qualification ?? undefined,
      serviceStandard: row.serviceStandard ?? undefined,
      directInviteCount: row.directInviteCount,
    }));
    const edm = await this.effectiveDirectMap(items.map((i) => i.id));
    for (const it of items) it.directInviteCount = edm[it.id] ?? 0;

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async getConsultantDetail(id: string): Promise<ConsultantInfo & {
    wechatQrcodeUrl?: string;
    alipayQrcodeUrl?: string;
    companyQrcodeUrl?: string;
    companyAuditStatus?: string;
    createdAt: string;
  }> {
    const result = await this.db
      .select({
        id: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
        level: users.level,
        phone: users.phone,
        industry: users.industry,
        qualification: users.qualification,
        serviceStandard: users.serviceStandard,
        wechatQrcodeUrl: users.wechatQrcodeUrl,
        alipayQrcodeUrl: users.alipayQrcodeUrl,
        companyQrcodeUrl: users.companyQrcodeUrl,
        companyAuditStatus: users.companyAuditStatus,
        assessmentStatus: users.assessmentStatus,
        directInviteCount: users.directInviteCount,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('咨询师不存在');
    }

    const row = result[0];

    // 管理员（零号线）即使是初级也可以查看详情
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    if (row.level === LEVELS.JUNIOR && row.id !== ADMIN_ID) {
      throw new NotFoundException('咨询师不存在');
    }

    const isLevel7OrAbove: boolean =
      row.level === LEVELS.LEVEL_7 || row.level === LEVELS.LEVEL_8;
    const hasCompanyApproval: boolean = row.companyAuditStatus === 'approved';
    // 管理员（零号线）例外：始终显示个人收款码
    const isAdmin: boolean = row.id === ADMIN_ID;

    // 四星考核中（collecting）：咨询费收款码替换为平台（管理员）收款码
    let effectiveWechat = row.wechatQrcodeUrl;
    let effectiveAlipay = row.alipayQrcodeUrl;
    let effectiveCompany = row.companyQrcodeUrl;
    if (row.assessmentStatus === 'collecting') {
      const adminRows = await this.db
        .select({
          wechatQrcodeUrl: users.wechatQrcodeUrl,
          alipayQrcodeUrl: users.alipayQrcodeUrl,
          companyQrcodeUrl: users.companyQrcodeUrl,
        })
        .from(users)
        .where(eq(users.id, ADMIN_ID))
        .limit(1);
      if (adminRows.length > 0) {
        const admin = adminRows[0];
        effectiveWechat = admin.wechatQrcodeUrl ?? admin.companyQrcodeUrl;
        effectiveAlipay = admin.alipayQrcodeUrl ?? admin.companyQrcodeUrl;
        effectiveCompany = admin.companyQrcodeUrl ?? admin.wechatQrcodeUrl;
      }
      this.logger.log(`四星考核代收，收款码替换为平台码: consultantId=${row.id}`);
    }

    const edCount = (await this.effectiveDirectMap([id]))[id] ?? 0;

    return {
      id: row.id,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl ?? undefined,
      level: row.level,
      phone: row.phone,
      industry: row.industry ?? undefined,
      qualification: row.qualification ?? undefined,
      serviceStandard: row.serviceStandard ?? undefined,
      directInviteCount: edCount,
      wechatQrcodeUrl:
        row.assessmentStatus === 'collecting'
          ? effectiveWechat ?? undefined
          : (!isLevel7OrAbove || isAdmin) ? effectiveWechat ?? undefined : undefined,
      alipayQrcodeUrl:
        row.assessmentStatus === 'collecting'
          ? effectiveAlipay ?? undefined
          : (!isLevel7OrAbove || isAdmin) ? effectiveAlipay ?? undefined : undefined,
      companyQrcodeUrl:
        row.assessmentStatus === 'collecting'
          ? effectiveCompany ?? undefined
          : (isLevel7OrAbove && hasCompanyApproval) || isAdmin
            ? effectiveCompany ?? undefined
            : undefined,
      companyAuditStatus: row.companyAuditStatus ?? undefined,
      platformCollecting: row.assessmentStatus === 'collecting',
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getIndustries(): Promise<IndustryInfo[]> {
    const result = await this.db
      .select({
        id: industries.id,
        name: industries.name,
        sortOrder: industries.sortOrder,
      })
      .from(industries)
      .orderBy(asc(industries.sortOrder));

    return result.map((row): IndustryInfo => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
    }));
  }
}
