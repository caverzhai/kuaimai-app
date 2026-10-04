import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminService } from './admin.service';

interface FinanceInfo {
  totalConsultIncome: string;
  pendingReclaimAmount: string;
  overflowLossAmount: string;
  permanentLossAmount: string; // 永久流失（级别不够）
  // 四星考核（可返回流失）
  assessmentStatus: string;
  fourStarAt?: string;
  platformCollectedAmount: string;
  refundRate?: number;
  refundedAmount: string;
  refundStatus: string;
  thresholdBlocked: boolean;
  thresholdTriggeredAt?: string;
  directInviteCount: number;
  wechatQrcodeUrl?: string;
  alipayQrcodeUrl?: string;
  companyQrcodeUrl?: string;
  level: string;
}

@Controller('api/finance')
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(private readonly adminService: AdminService) {}

  @Get('info')
  async getFinanceInfo(@Req() req: Request): Promise<FinanceInfo> {
    const userId = req.user!.userId;
    return this.adminService.getFinanceInfo(userId);
  }
}
