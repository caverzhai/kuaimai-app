import type { Request } from 'express';
import { ConsultantsService } from './consultants.service';
import type { ConsultantListQuery, ConsultantListResponse, IndustryInfo } from '@shared/api.interface';
export declare class ConsultantsController {
    private readonly consultantsService;
    constructor(consultantsService: ConsultantsService);
    getIndustries(): Promise<IndustryInfo[]>;
    getConsultantList(req: Request, query: ConsultantListQuery): Promise<ConsultantListResponse>;
    getConsultantDetail(req: Request, id: string): Promise<import("@shared/api.interface").ConsultantInfo & {
        wechatQrcodeUrl?: string;
        alipayQrcodeUrl?: string;
        companyQrcodeUrl?: string;
        companyAuditStatus?: string;
        createdAt: string;
    }>;
}
