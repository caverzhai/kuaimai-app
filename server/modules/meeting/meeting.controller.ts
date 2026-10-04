import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@server/common/guards/auth.guard';
import { MeetingService } from './meeting.service';

const ADMIN_PHONE = '13800000000';

// 会议室为高频准实时场景，单独放宽限流
@Throttle({ default: { ttl: 60000, limit: 240 } })
@Controller('api/meeting')
@UseGuards(AuthGuard)
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Get()
  getRoomList() {
    return this.meetingService.getRoomList();
  }

  @Get(':id/state')
  getState(
    @Param('id') id: string,
    @Query('sinceSeq') sinceSeq: string,
    @Req() req: any,
  ) {
    return this.meetingService.getState(id, req.user.userId, Number(sinceSeq ?? 0));
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Req() req: any) {
    return this.meetingService.heartbeat(id, req.user.userId);
  }

  @Delete(':id/presence')
  leave(@Param('id') id: string, @Req() req: any) {
    return this.meetingService.leave(id, req.user.userId);
  }

  @Post(':id/hand')
  raiseHand(@Param('id') id: string, @Req() req: any) {
    return this.meetingService.raiseHand(id, req.user.userId);
  }

  @Post(':id/hand/cancel')
  cancelHand(@Param('id') id: string, @Req() req: any) {
    return this.meetingService.cancelHand(id, req.user.userId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { userId: string }, @Req() req: any) {
    return this.meetingService.approve(
      id,
      req.user.userId,
      req.user.phone === ADMIN_PHONE,
      body.userId,
    );
  }

  @Post(':id/stop')
  stop(@Param('id') id: string, @Req() req: any) {
    return this.meetingService.stop(id, req.user.userId, req.user.phone === ADMIN_PHONE);
  }

  @Post(':id/host')
  assignHost(@Param('id') id: string, @Body() body: { userId: string }, @Req() req: any) {
    return this.meetingService.assignHost(
      id,
      req.user.phone === ADMIN_PHONE,
      body.userId,
    );
  }

  @Post(':id/chunks')
  uploadChunk(
    @Param('id') id: string,
    @Body() body: { base64: string; duration?: number },
    @Req() req: any,
  ) {
    return this.meetingService.uploadChunk(
      id,
      req.user.userId,
      body.base64,
      Number(body.duration ?? 0),
    );
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Query('sinceTime') sinceTime: string) {
    return this.meetingService.getMessages(id, sinceTime || null);
  }

  @Delete(':id/messages')
  clearMessages(@Param('id') id: string, @Req() req: any) {
    return this.meetingService.clearMessages(id, req.user.userId, req.user.phone === ADMIN_PHONE);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() body: { content: string }, @Req() req: any) {
    return this.meetingService.sendMessage(id, req.user.userId, body.content);
  }

  @Post(':id/mute')
  mute(@Param('id') id: string, @Body() body: { userId: string; minutes?: number }, @Req() req: any) {
    return this.meetingService.muteUser(id, req.user.userId, req.user.phone === ADMIN_PHONE, body.userId, body.minutes);
  }

  @Post(':id/unmute')
  unmute(@Param('id') id: string, @Body() body: { userId: string }, @Req() req: any) {
    return this.meetingService.unmuteUser(id, req.user.userId, req.user.phone === ADMIN_PHONE, body.userId);
  }

  @Post(':id/kick')
  kick(@Param('id') id: string, @Body() body: { userId: string }, @Req() req: any) {
    return this.meetingService.kickUser(id, req.user.userId, req.user.phone === ADMIN_PHONE, body.userId);
  }

  @Post(':id/unkick')
  unkick(@Param('id') id: string, @Body() body: { userId: string }, @Req() req: any) {
    return this.meetingService.unkickUser(id, req.user.userId, req.user.phone === ADMIN_PHONE, body.userId);
  }
}
