import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ConsultantInfo, ConsultantListQuery, ConsultantListResponse, IndustryInfo } from '@shared/api.interface';
export declare class ConsultantsService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    getConsultantList(query: ConsultantListQuery): Promise<ConsultantListResponse>;
    getConsultantDetail(id: string): Promise<ConsultantInfo & {
        wechatQrcodeUrl?: string;
        alipayQrcodeUrl?: string;
        companyQrcodeUrl?: string;
        companyAuditStatus?: string;
        createdAt: string;
    }>;
    getIndustries(): Promise<IndustryInfo[]>;
}
