import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, inArray, desc, gt, sql } from 'drizzle-orm';

import {
  chatMessages,
  chatRoomMembers,
  chatRooms,
  chatBlockedWords,
  users,
} from '@server/database/schema';
import { ChatRoomsService } from '../chat-rooms/chat-rooms.service';

const MESSAGE_EXPIRE_MINUTES = 30;

@Injectable()
export class ChatMessagesService {
  private readonly logger = new Logger(ChatMessagesService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly chatRoomsService: ChatRoomsService,
  ) {}

  // 发送消息
  async sendMessage(roomId: string, userId: string, data: {
    type: 'text' | 'image' | 'audio';
    content: string;
    duration?: number;
  }) {
    // 检查聊天室
    const roomRows = await this.db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
    if (roomRows.length === 0) throw new NotFoundException('聊天室不存在');
    if (!roomRows[0].isActive) throw new BadRequestException('聊天室已关闭');

    // 检查成员状态
    const memberRows = await this.db.select().from(chatRoomMembers).where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId))).limit(1);
    if (memberRows.length === 0) throw new ForbiddenException('你不是该聊天室成员');
    if (memberRows[0].isBlocked) throw new ForbiddenException('你已被拉黑');
    if (memberRows[0].isMuted && data.type === 'text') throw new ForbiddenException('你已被禁言');

    // 验证内容
    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestException('消息内容不能为空');
    }

    // 文字消息过滤屏蔽词
    let content = data.content;
    if (data.type === 'text') {
      const blockedWords = await this.db.select({ word: chatBlockedWords.word }).from(chatBlockedWords);
      content = this.chatRoomsService.filterBlockedWords(content, blockedWords.map((w) => w.word));
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MESSAGE_EXPIRE_MINUTES);

    const inserted = await this.db
      .insert(chatMessages)
      .values({
        roomId,
        userId,
        type: data.type,
        content,
        duration: data.duration,
        expiresAt,
      })
      .returning();

    return {
      id: inserted[0].id,
      roomId: inserted[0].roomId,
      userId: inserted[0].userId,
      type: inserted[0].type,
      content: inserted[0].content,
      duration: inserted[0].duration,
      createdAt: inserted[0].createdAt.toISOString(),
    };
  }

  // 获取消息列表（只获取未过期的）
  async getMessages(roomId: string, userId: string, limit = 50) {
    // 检查成员
    const memberRows = await this.db.select().from(chatRoomMembers).where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId))).limit(1);
    if (memberRows.length === 0) throw new ForbiddenException('你不是该聊天室成员');

    const now = new Date();
    const messages = await this.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.roomId, roomId), gt(chatMessages.expiresAt, now)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // 获取用户信息
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const userInfos = userIds.length > 0
      ? await this.db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userInfos.map((u) => [u.id, u]));

    return {
      items: messages.reverse().map((msg) => ({
        id: msg.id,
        roomId: msg.roomId,
        userId: msg.userId,
        nickname: userMap.get(msg.userId)?.nickname || '未知用户',
        avatarUrl: userMap.get(msg.userId)?.avatarUrl,
        type: msg.type,
        content: msg.content,
        duration: msg.duration,
        createdAt: msg.createdAt.toISOString(),
      })),
    };
  }

  // 清理过期消息（定时任务调用）
  async cleanExpiredMessages() {
    const now = new Date();
    const deleted = await this.db
      .delete(chatMessages)
      .where(lt(chatMessages.expiresAt, now))
      .returning({ id: chatMessages.id });
    this.logger.log(`清理过期消息: ${deleted.length} 条`);
    return { cleaned: deleted.length };
  }
}

// 辅助函数：小于
function lt(column: any, value: any) {
  return sql`${column} < ${value}`;
}
