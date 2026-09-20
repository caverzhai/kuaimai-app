import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
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

@Controller('api/finance')
@UseGuards(AuthGuard, AdminGuard)
export class FinanceController {
  constructor(private readonly adminService: AdminService) {}

  @Get('info')
  async getFinanceInfo(@Req() req: Request): Promise<FinanceInfo> {
    const userId = req.user!.userId;
    return this.adminService.getFinanceInfo(userId);
  }
}
