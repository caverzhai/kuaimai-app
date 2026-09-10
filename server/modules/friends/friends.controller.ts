import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@server/common/guards/auth.guard';
import { FriendsService } from './friends.service';

@Controller('api/friends')
@UseGuards(AuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  // 好友列表
  @Get()
  async getFriendList(@Req() req: Request) {
    return this.friendsService.getFriendList(req.user!.userId);
  }

  // 好友请求列表
  @Get('requests')
  async getFriendRequests(@Req() req: Request) {
    return this.friendsService.getFriendRequests(req.user!.userId);
  }

  // 添加好友
  @Post()
  async addFriend(@Req() req: Request, @Body() body: { phone: string }) {
    return this.friendsService.addFriend(req.user!.userId, body.phone);
  }

  // 接受/拒绝好友请求
  @Post('requests/:id/respond')
  async respondFriendRequest(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { accept: boolean },
  ) {
    return this.friendsService.respondFriendRequest(req.user!.userId, id, body.accept);
  }

  // 创建个人聊天室
  @Post('room')
  async createPersonalRoom(
    @Req() req: Request,
    @Body() body: { name: string; memberIds: string[] },
  ) {
    return this.friendsService.createPersonalRoom(req.user!.userId, body);
  }
}
