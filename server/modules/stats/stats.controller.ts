import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { StatsService } from './stats.service';
import { AuthGuard } from '@server/common/guards/auth.guard';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  // 收入日统计（商城/咨询分开）
  @Get('income')
  @UseGuards(AuthGuard)
  income(@Req() req: Request) {
    return this.stats.getIncomeStats(req.user!.userId);
  }

  // 树下多层会员详情（默认5层）
  @Get('downline')
  @UseGuards(AuthGuard)
  downline(@Req() req: Request, @Query('levels') levels?: string) {
    const parsed = parseInt(levels ?? '5', 10);
    const n = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), 9);
    return this.stats.getDownlineDetails(req.user!.userId, n);
  }

  // 最近 N 天咨询费明细（默认3天）
  @Get('consult-recent')
  @UseGuards(AuthGuard)
  consultRecent(@Req() req: Request, @Query('days') days?: string) {
    const parsed = parseInt(days ?? '3', 10);
    const n = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 3, 1), 30);
    return this.stats.getRecentConsult(req.user!.userId, n);
  }
}
