import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { TeamService } from './team.service';
import { AuthGuard } from '@server/common/guards/auth.guard';
import type { InviteInfo, TeamInfo } from '@shared/api.interface';

@Controller('api/team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('tree')
  @UseGuards(AuthGuard)
  async getTeamTree(@Req() req: Request): Promise<TeamInfo> {
    const userId = req.user!.userId;
    const isInvited = req.user!.isInvited;
    return this.teamService.getTeamTree(userId, isInvited);
  }

  @Get('invite')
  @UseGuards(AuthGuard)
  async getInviteInfo(@Req() req: Request): Promise<InviteInfo> {
    const userId = req.user!.userId;
    const level = req.user!.level;
    return this.teamService.getInviteInfo(userId, level);
  }
}
