import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { UsersService } from './users.service';
import { AuthGuard } from '@server/common/guards/auth.guard';
import type {
  SupplementInviterDTO,
  UpdateProfileDTO,
  UserInfo,
} from '@shared/api.interface';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: Request): Promise<UserInfo> {
    const userId = req.user!.userId;
    return this.usersService.getCurrentUser(userId);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDTO,
  ): Promise<UserInfo> {
    const userId = req.user!.userId;
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('supplement-inviter')
  @UseGuards(AuthGuard)
  async supplementInviter(
    @Req() req: Request,
    @Body() dto: SupplementInviterDTO,
  ): Promise<UserInfo> {
    const userId = req.user!.userId;
    return this.usersService.supplementInviter(userId, dto);
  }

  @Get('invite-code')
  @UseGuards(AuthGuard)
  async getInviteCode(
    @Req() req: Request,
  ): Promise<{ inviteCode: string }> {
    const userId = req.user!.userId;
    return this.usersService.getOrGenerateInviteCode(userId);
  }
}
