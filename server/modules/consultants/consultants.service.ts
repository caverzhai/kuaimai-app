import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, ne, and, or, count, desc, asc, ilike, sql } from 'drizzle-orm';
import { users, industries } from '@server/database/schema';
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

    return {
      id: row.id,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl ?? undefined,
      level: row.level,
      phone: row.phone,
      industry: row.industry ?? undefined,
      qualification: row.qualification ?? undefined,
      serviceStandard: row.serviceStandard ?? undefined,
      directInviteCount: row.directInviteCount,
      wechatQrcodeUrl:
        !isLevel7OrAbove ? row.wechatQrcodeUrl ?? undefined : undefined,
      alipayQrcodeUrl:
        !isLevel7OrAbove ? row.alipayQrcodeUrl ?? undefined : undefined,
      companyQrcodeUrl:
        isLevel7OrAbove && hasCompanyApproval
          ? row.companyQrcodeUrl ?? undefined
          : undefined,
      companyAuditStatus: row.companyAuditStatus ?? undefined,
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
