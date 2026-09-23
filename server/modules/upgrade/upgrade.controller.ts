import {
  Controller,
  Get,
  Post,
  Delete,
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
import { AdminGuard } from '@server/common/guards/admin.guard';
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

  // 管理员接口：重置指定用户的所有升级任务
  @Delete('tasks/reset/:userId')
  @UseGuards(AuthGuard, AdminGuard)
  async resetTasks(@Param('userId') userId: string): Promise<{ success: boolean; message: string }> {
    return this.upgradeService.resetUserTasks(userId);
  }

  // 管理员接口：清空全部用户的升级任务（规则大改后全量重新生成）
  @Delete('reset-all')
  @UseGuards(AuthGuard, AdminGuard)
  async resetAllTasks(): Promise<{ success: boolean; message: string }> {
    return this.upgradeService.resetAllTasks();
  }
}
