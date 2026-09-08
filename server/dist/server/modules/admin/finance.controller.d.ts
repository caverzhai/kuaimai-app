import type { Request } from 'express';
import { AdminService } from './admin.service';
interface FinanceInfo {
    totalConsultIncome: string;
    pendingReclaimAmount: string;
    overflowLossAmount: string;
    thresholdBlocked: boolean;
    thresholdTriggeredAt?: string;
    directInviteCount: number;
    wechatQrcodeUrl?: string;
    alipayQrcodeUrl?: string;
    companyQrcodeUrl?: string;
    level: string;
}
export declare class FinanceController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getFinanceInfo(req: Request): Promise<FinanceInfo>;
}
export {};
