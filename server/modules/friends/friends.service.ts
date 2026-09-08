import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, inArray, desc, sql } from 'drizzle-orm';

import { friends, users, chatRooms, chatRoomMembers } from '@server/database/schema';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // 获取好友列表
  async getFriendList(userId: string) {
    const friendRelations = await this.db
      .select()
      .from(friends)
      .where(and(eq(friends.userId, userId), eq(friends.status, 'accepted')));

    const friendIds = friendRelations.map((f) => f.friendId);
    const friendInfos = friendIds.length > 0
      ? await this.db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl, phone: users.phone }).from(users).where(inArray(users.id, friendIds))
      : [];
    const friendMap = new Map(friendInfos.map((u) => [u.id, u]));

    return {
      items: friendRelations.map((f) => ({
        id: f.id,
        friendId: f.friendId,
        nickname: friendMap.get(f.friendId)?.nickname || '未知',
        avatarUrl: friendMap.get(f.friendId)?.avatarUrl,
        phone: friendMap.get(f.friendId)?.phone,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  // 获取好友请求列表
  async getFriendRequests(userId: string) {
    const requests = await this.db
      .select()
      .from(friends)
      .where(and(eq(friends.friendId, userId), eq(friends.status, 'pending')))
      .orderBy(desc(friends.createdAt));

    const requesterIds = requests.map((r) => r.userId);
    const requesterInfos = requesterIds.length > 0
      ? await this.db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, requesterIds))
      : [];
    const requesterMap = new Map(requesterInfos.map((u) => [u.id, u]));

    return {
      items: requests.map((r) => ({
        id: r.id,
        requesterId: r.userId,
        nickname: requesterMap.get(r.userId)?.nickname || '未知',
        avatarUrl: requesterMap.get(r.userId)?.avatarUrl,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // 添加好友
  async addFriend(userId: string, friendPhone: string) {
    if (!friendPhone || friendPhone.trim().length === 0) {
      throw new BadRequestException('请输入好友手机号');
    }

    // 查找好友
    const friendRows = await this.db.select().from(users).where(eq(users.phone, friendPhone.trim())).limit(1);
    if (friendRows.length === 0) throw new NotFoundException('用户不存在');
    const friend = friendRows[0];

    if (friend.id === userId) throw new BadRequestException('不能添加自己为好友');

    // 检查是否已经是好友或已有请求
    const existing = await this.db
      .select()
      .from(friends)
      .where(or(
        and(eq(friends.userId, userId), eq(friends.friendId, friend.id)),
        and(eq(friends.userId, friend.id), eq(friends.friendId, userId)),
      ))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].status === 'accepted') {
        throw new BadRequestException('已经是好友了');
      } else if (existing[0].status === 'pending') {
        throw new BadRequestException('好友请求已发送，等待对方确认');
      }
    }

    await this.db.insert(friends).values({ userId, friendId: friend.id, status: 'pending' });
    this.logger.log(`添加好友请求: userId=${userId}, friendId=${friend.id}`);
    return { success: true, message: '好友请求已发送' };
  }

  // 接受/拒绝好友请求
  async respondFriendRequest(userId: string, requestId: string, accept: boolean) {
    const requestRows = await this.db.select().from(friends).where(eq(friends.id, requestId)).limit(1);
    if (requestRows.length === 0) throw new NotFoundException('请求不存在');
    const request = requestRows[0];

    if (request.friendId !== userId) throw new BadRequestException('无权操作此请求');
    if (request.status !== 'pending') throw new BadRequestException('请求已处理');

    if (accept) {
      // 接受：双向建立好友关系
      await this.db.update(friends).set({ status: 'accepted' }).where(eq(friends.id, requestId));
      // 反向也建立一条
      await this.db.insert(friends).values({ userId, friendId: request.userId, status: 'accepted' }).catch(() => {});
      return { success: true, message: '已接受好友请求' };
    } else {
      await this.db.update(friends).set({ status: 'rejected' }).where(eq(friends.id, requestId));
      return { success: true, message: '已拒绝好友请求' };
    }
  }

  // 创建个人聊天室（好友之间）
  async createPersonalRoom(userId: string, data: { name: string; memberIds: string[] }) {
    if (!data.memberIds || data.memberIds.length === 0) {
      throw new BadRequestException('请选择聊天室成员');
    }

    // 验证所有成员都是好友
    const friendRelations = await this.db
      .select({ friendId: friends.friendId })
      .from(friends)
      .where(and(eq(friends.userId, userId), eq(friends.status, 'accepted')));
    const friendIds = new Set(friendRelations.map((f) => f.friendId));

    for (const memberId of data.memberIds) {
      if (memberId !== userId && !friendIds.has(memberId)) {
        throw new BadRequestException('只能与好友创建聊天室');
      }
    }

    // 创建聊天室
    const inserted = await this.db
      .insert(chatRooms)
      .values({
        name: data.name || '好友聊天室',
        type: 'personal',
        createdBy: userId,
        maxMicCount: 0,
      })
      .returning();

    const room = inserted[0];

    // 添加所有成员
    const allMemberIds = [userId, ...data.memberIds.filter((id) => id !== userId)];
    for (const memberId of allMemberIds) {
      await this.db.insert(chatRoomMembers).values({
        roomId: room.id,
        userId: memberId,
        role: memberId === userId ? 'owner' : 'member',
      }).catch(() => {});
    }

    this.logger.log(`创建个人聊天室: roomId=${room.id}, name=${room.name}, members=${allMemberIds.length}`);
    return { id: room.id, name: room.name, type: 'personal' };
  }
}
