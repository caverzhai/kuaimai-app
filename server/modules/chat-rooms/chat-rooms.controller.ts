import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@server/common/guards/auth.guard';
import { ChatRoomsService } from './chat-rooms.service';

@Controller('api/chat-rooms')
@UseGuards(AuthGuard)
export class ChatRoomsController {
  constructor(private readonly chatRoomsService: ChatRoomsService) {}

  // 获取聊天室列表
  @Get()
  async getRoomList(@Req() req: Request) {
    return this.chatRoomsService.getRoomList(req.user!.userId);
  }

  // 创建聊天室
  @Post()
  async createRoom(
    @Req() req: Request,
    @Body() body: { name: string; description?: string; type: 'public' | 'personal'; memberIds?: string[] },
  ) {
    return this.chatRoomsService.createRoom(req.user!.userId, req.user!.phone, body);
  }

  // 提交聊天室申请
  @Post('applications')
  async createApplication(
    @Req() req: Request,
    @Body() body: { roomName: string; description: string; usageTime: string; contactPhone: string },
  ) {
    return this.chatRoomsService.createApplication(req.user!.userId, body);
  }

  // 获取聊天室申请列表
  @Get('applications')
  async getApplications(@Req() req: Request) {
    const isAdmin = req.user!.phone === '13800000000';
    return this.chatRoomsService.getApplications(req.user!.userId, isAdmin);
  }

  // 管理员同意聊天室申请
  @Post('applications/:id/approve')
  async approveApplication(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { roomName?: string; description?: string },
  ) {
    return this.chatRoomsService.approveApplication(req.user!.userId, id, body);
  }

  // 管理员拒绝聊天室申请
  @Post('applications/:id/reject')
  async rejectApplication(@Param('id') id: string, @Req() req: Request) {
    return this.chatRoomsService.rejectApplication(req.user!.userId, id);
  }

  // 获取聊天室详情
  @Get(':id')
  async getRoomDetail(@Param('id') id: string, @Req() req: Request) {
    return this.chatRoomsService.getRoomDetail(id, req.user!.userId);
  }

  // 禁言用户
  @Post(':id/mute')
  async muteUser(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { userId: string; muted: boolean },
  ) {
    return this.chatRoomsService.muteUser(id, req.user!.userId, body.userId, body.muted);
  }

  // 拉黑用户
  @Post(':id/block')
  async blockUser(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { userId: string; blocked: boolean },
  ) {
    return this.chatRoomsService.blockUser(id, req.user!.userId, body.userId, body.blocked);
  }

  // 申请上麦
  @Post(':id/mic/request')
  async requestMic(@Param('id') id: string, @Req() req: Request) {
    return this.chatRoomsService.requestMic(id, req.user!.userId);
  }

  // 获取上麦申请列表
  @Get(':id/mic/requests')
  async getMicRequests(@Param('id') id: string, @Req() req: Request) {
    const isAdmin = req.user!.phone === '13800000000';
    return this.chatRoomsService.getMicRequests(id, req.user!.userId, isAdmin);
  }

  // 管理员同意上麦申请
  @Post(':id/mic/requests/:requestId/approve')
  async approveMicRequest(@Param('id') id: string, @Param('requestId') requestId: string, @Req() req: Request) {
    return this.chatRoomsService.approveMicRequest(id, req.user!.userId, requestId);
  }

  // 管理员拒绝上麦申请
  @Post(':id/mic/requests/:requestId/reject')
  async rejectMicRequest(@Param('id') id: string, @Param('requestId') requestId: string, @Req() req: Request) {
    return this.chatRoomsService.rejectMicRequest(id, req.user!.userId, requestId);
  }

  // 上麦（需要管理员先同意申请）
  @Post(':id/mic/take')
  async takeMic(@Param('id') id: string, @Req() req: Request, @Body() body?: { slotIndex?: number }) {
    return this.chatRoomsService.takeMic(id, req.user!.userId, body?.slotIndex);
  }

  // 下麦
  @Post(':id/mic/leave')
  async leaveMic(@Param('id') id: string, @Req() req: Request) {
    return this.chatRoomsService.leaveMic(id, req.user!.userId);
  }

  // 管理员指定主持人
  @Post(':id/mic/assign')
  async assignHost(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { userId: string; slotIndex: number },
  ) {
    return this.chatRoomsService.assignHost(id, req.user!.userId, body.userId, body.slotIndex);
  }

  // 关闭聊天室
  @Post(':id/close')
  async closeRoom(@Param('id') id: string, @Req() req: Request) {
    return this.chatRoomsService.closeRoom(id, req.user!.phone);
  }

  // 屏蔽词列表
  @Get('blocked-words/list')
  async getBlockedWords() {
    return this.chatRoomsService.getBlockedWords();
  }

  // 添加屏蔽词
  @Post('blocked-words')
  async addBlockedWord(@Req() req: Request, @Body() body: { word: string }) {
    return this.chatRoomsService.addBlockedWord(body.word, req.user!.phone);
  }

  // 删除屏蔽词
  @Delete('blocked-words/:id')
  async removeBlockedWord(@Param('id') id: string, @Req() req: Request) {
    return this.chatRoomsService.removeBlockedWord(id, req.user!.phone);
  }
}
