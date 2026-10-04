import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, finalize } from 'rxjs';

import { AuthGuard } from '@server/common/guards/auth.guard';
import { verifyToken } from '@server/common/utils/auth.util';
import { NotificationsService, SendNotificationDTO } from './notifications.service';

const ADMIN_PHONES = ['13800000000'];

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // 用户拉取新通知（增量，after=本地已收到的最大 seq）
  @Get('pending')
  @UseGuards(AuthGuard)
  async getPending(@Req() req: Request, @Query('after') after?: string) {
    const afterSeq = Math.max(0, parseInt(after ?? '0', 10) || 0);
    return await this.notificationsService.getPending(req.user!.userId, afterSeq);
  }

  // 前台实时通道（SSE）：EventSource 无法带自定义头，token 走 query
  @Sse('stream')
  stream(@Query('token') token?: string): Observable<any> {
    if (!token) throw new UnauthorizedException('未登录');
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      throw new UnauthorizedException('Token无效或已过期');
    }
    const userId = decoded.userId;
    const subj = this.notificationsService.addStream(userId);
    subj.next({ data: { type: 'connected' } });
    return subj
      .asObservable()
      .pipe(finalize(() => this.notificationsService.removeStream(userId, subj)));
  }

  // 客户端确认 collect 通知已处理（已交给系统通知栏 / 已展示）
  @Post('ack/:id')
  @UseGuards(AuthGuard)
  async ack(@Req() req: Request, @Param('id') id: string) {
    return this.notificationsService.ack(req.user!.userId, id);
  }

  private ensureAdmin(req: Request) {
    const phone = req.user?.phone;
    if (!phone || !ADMIN_PHONES.includes(phone)) {
      throw new ForbiddenException('无管理员权限');
    }
  }

  // 管理员发送通知（全员/指定）
  @Post('send')
  @UseGuards(AuthGuard)
  async send(@Req() req: Request, @Body() dto: SendNotificationDTO) {
    this.ensureAdmin(req);
    const notification = await this.notificationsService.send(dto, req.user!.userId);
    return { notification };
  }

  // 管理员查看已发通知
  @Get('all')
  @UseGuards(AuthGuard)
  async listAll(@Req() req: Request) {
    this.ensureAdmin(req);
    const notifications = await this.notificationsService.listAll();
    return { notifications };
  }

  // 平台公告：公开获取当前内容（无需登录）
  @Get('current')
  async getCurrentNotice() {
    return this.notificationsService.getCurrentNotice();
  }

  // 平台公告：管理员更新
  @Put('current')
  @UseGuards(AuthGuard)
  async updateNotice(@Req() req: Request, @Body() body: { content: string }) {
    this.ensureAdmin(req);
    return this.notificationsService.updateNotice(body?.content ?? '', req.user!.userId);
  }
}
