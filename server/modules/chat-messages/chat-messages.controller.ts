import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@server/common/guards/auth.guard';
import { ChatMessagesService } from './chat-messages.service';

@Controller('api/chat-messages')
@UseGuards(AuthGuard)
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  // 发送消息
  @Post(':roomId')
  async sendMessage(
    @Param('roomId') roomId: string,
    @Req() req: Request,
    @Body() body: { type: 'text' | 'image' | 'audio'; content: string; duration?: number },
  ) {
    return this.chatMessagesService.sendMessage(roomId, req.user!.userId, body);
  }

  // 获取消息列表
  @Get(':roomId')
  async getMessages(
    @Param('roomId') roomId: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    return this.chatMessagesService.getMessages(roomId, req.user!.userId, limit ? parseInt(limit, 10) : 50);
  }
}
