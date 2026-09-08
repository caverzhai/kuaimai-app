import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import type {
  UpgradeCenterInfo,
  UpgradeTaskInfo,
} from '@shared/api.interface';
import { AuthGuard } from '@server/common/guards/auth.guard';
import { UpgradeService } from './upgrade.service';

@Controller('api/upgrade')
export class UpgradeController {
  constructor(private readonly upgradeService: UpgradeService) {}

  @Get('center')
  @UseGuards(AuthGuard)
  async getUpgradeCenter(@Req() req: Request): Promise<UpgradeCenterInfo> {
    const userId: string = req.user!.userId;
    return this.upgradeService.getUpgradeCenter(userId);
  }

  @Post('tasks/:taskId/start')
  @UseGuards(AuthGuard)
  async startTask(
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ): Promise<UpgradeTaskInfo> {
    const userId: string = req.user!.userId;
    return this.upgradeService.startTask(taskId, userId);
  }
}
