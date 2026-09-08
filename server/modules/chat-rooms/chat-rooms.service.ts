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
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

import {
  chatRooms,
  chatRoomMembers,
  chatMicSlots,
  chatMicRequests,
  chatRoomApplications,
  chatBlockedWords,
  users,
} from '@server/database/schema';

type UserSelect = typeof users.$inferSelect;
type RoomSelect = typeof chatRooms.$inferSelect;

const ADMIN_PHONES = ['13800000000'];

@Injectable()
export class ChatRoomsService {
  private readonly logger = new Logger(ChatRoomsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {
    // 定时任务：每分钟检查定时上线/下线的聊天室
    this.startScheduledTask();
  }

  private scheduledTimer: NodeJS.Timeout | null = null;

  private startScheduledTask() {
    if (this.scheduledTimer) return;
    this.scheduledTimer = setInterval(async () => {
      try {
        const now = new Date();
        // 自动上线：scheduledStartTime <= now 且 isActive = false
        await this.db.execute(sql`
          UPDATE chat_rooms 
          SET is_active = true, _updated_at = CURRENT_TIMESTAMP
          WHERE is_active = false 
            AND scheduled_start_time IS NOT NULL 
            AND scheduled_start_time <= ${now}
        `);
        // 自动下线：scheduledEndTime <= now 且 isActive = true
        await this.db.execute(sql`
          UPDATE chat_rooms 
          SET is_active = false, _updated_at = CURRENT_TIMESTAMP
          WHERE is_active = true 
            AND scheduled_end_time IS NOT NULL 
            AND scheduled_end_time <= ${now}
        `);
      } catch (err) {
        this.logger.error('定时任务执行失败', err);
      }
    }, 60000); // 每分钟检查一次
  }

  // 获取聊天室列表
  async getRoomList(userId: string) {
    const rooms = await this.db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.isActive, true))
      .orderBy(desc(chatRooms.createdAt));

    // 获取每个聊天室的在线人数和麦位信息
    const roomIds = rooms.map((r) => r.id);
    const members = roomIds.length > 0
      ? await this.db.select().from(chatRoomMembers).where(inArray(chatRoomMembers.roomId, roomIds))
      : [];
    const mics = roomIds.length > 0
      ? await this.db.select().from(chatMicSlots).where(and(inArray(chatMicSlots.roomId, roomIds), eq(chatMicSlots.isActive, true)))
      : [];

    const memberCountMap = new Map<string, number>();
    const micMap = new Map<string, typeof mics>();
    for (const m of members) {
      memberCountMap.set(m.roomId, (memberCountMap.get(m.roomId) || 0) + 1);
    }
    for (const mic of mics) {
      const list = micMap.get(mic.roomId) || [];
      list.push(mic);
      micMap.set(mic.roomId, list);
    }

    // 获取麦位用户信息
    const micUserIds = mics.map((m) => m.userId);
    const micUsers = micUserIds.length > 0
      ? await this.db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, micUserIds))
      : [];
    const micUserMap = new Map(micUsers.map((u) => [u.id, u]));

    return {
      items: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        type: room.type,
        createdBy: room.createdBy,
        maxMicCount: room.maxMicCount,
        memberCount: memberCountMap.get(room.id) || 0,
        micSlots: (micMap.get(room.id) || []).map((mic) => ({
          slotIndex: mic.slotIndex,
          userId: mic.userId,
          nickname: micUserMap.get(mic.userId)?.nickname || '未知',
          avatarUrl: micUserMap.get(mic.userId)?.avatarUrl,
        })),
        createdAt: room.createdAt.toISOString(),
      })),
    };
  }

  // 创建聊天室（管理员或用户）
  async createRoom(userId: string, userPhone: string, data: {
    name: string;
    description?: string;
    type: 'public' | 'personal';
    memberIds?: string[]; // 个人聊天室的成员
  }) {
    const isAdmin = ADMIN_PHONES.includes(userPhone);
    if (data.type === 'public' && !isAdmin) {
      throw new ForbiddenException('只有管理员可以创建公开聊天室');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('聊天室名称不能为空');
    }

    const maxMicCount = data.type === 'public' ? 3 : 0;

    const inserted = await this.db
      .insert(chatRooms)
      .values({
        name: data.name.trim(),
        description: data.description,
        type: data.type,
        createdBy: userId,
        maxMicCount,
      })
      .returning();

    const room = inserted[0];

    // 创建者自动加入并设为owner
    await this.db.insert(chatRoomMembers).values({
      roomId: room.id,
      userId,
      role: 'owner',
    });

    // 个人聊天室添加其他成员
    if (data.type === 'personal' && data.memberIds) {
      for (const memberId of data.memberIds) {
        if (memberId !== userId) {
          await this.db.insert(chatRoomMembers).values({
            roomId: room.id,
            userId: memberId,
            role: 'member',
          }).catch(() => {});
        }
      }
    }

    this.logger.log(`创建聊天室: roomId=${room.id}, name=${room.name}, type=${data.type}`);
    return { id: room.id, name: room.name, type: room.type };
  }

  // 获取聊天室详情
  async getRoomDetail(roomId: string, userId: string) {
    const roomRows = await this.db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
    if (roomRows.length === 0) throw new NotFoundException('聊天室不存在');
    const room = roomRows[0];

    // 检查是否是成员（公开聊天室自动加入）
    const memberRows = await this.db.select().from(chatRoomMembers).where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId))).limit(1);
    let member = memberRows[0];

    if (!member && room.type === 'public') {
      // 公开聊天室自动加入
      await this.db.insert(chatRoomMembers).values({ roomId, userId, role: 'member' });
      member = { roomId, userId, role: 'member', isMuted: false, isBlocked: false } as any;
    }

    if (!member) {
      throw new ForbiddenException('你不是该聊天室成员');
    }

    if (member.isBlocked) {
      throw new ForbiddenException('你已被拉黑，无法进入该聊天室');
    }

    // 获取麦位信息
    const mics = await this.db.select().from(chatMicSlots).where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.isActive, true)));
    const micUserIds = mics.map((m) => m.userId);
    const micUsers = micUserIds.length > 0
      ? await this.db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, micUserIds))
      : [];
    const micUserMap = new Map(micUsers.map((u) => [u.id, u]));

    return {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      maxMicCount: room.maxMicCount,
      myRole: member.role,
      isMuted: member.isMuted,
      micSlots: mics.map((mic) => ({
        slotIndex: mic.slotIndex,
        userId: mic.userId,
        nickname: micUserMap.get(mic.userId)?.nickname || '未知',
        avatarUrl: micUserMap.get(mic.userId)?.avatarUrl,
      })),
    };
  }

  // 禁言用户
  async muteUser(roomId: string, operatorId: string, targetUserId: string, muted: boolean) {
    await this.checkPermission(roomId, operatorId);
    await this.db.update(chatRoomMembers)
      .set({ isMuted: muted })
      .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, targetUserId)));
    this.logger.log(`禁言操作: roomId=${roomId}, targetUserId=${targetUserId}, muted=${muted}`);
    return { success: true };
  }

  // 拉黑用户
  async blockUser(roomId: string, operatorId: string, targetUserId: string, blocked: boolean) {
    await this.checkPermission(roomId, operatorId);
    await this.db.update(chatRoomMembers)
      .set({ isBlocked: blocked })
      .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, targetUserId)));
    this.logger.log(`拉黑操作: roomId=${roomId}, targetUserId=${targetUserId}, blocked=${blocked}`);
    return { success: true };
  }

  // 申请上麦
  async requestMic(roomId: string, userId: string) {
    const roomRows = await this.db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
    if (roomRows.length === 0) throw new NotFoundException('聊天室不存在');
    if (roomRows[0].type !== 'public') throw new BadRequestException('个人聊天室无麦位功能');

    // 检查是否已有待审批的申请
    const existing = await this.db.select().from(chatMicRequests)
      .where(and(eq(chatMicRequests.roomId, roomId), eq(chatMicRequests.userId, userId), eq(chatMicRequests.status, 'pending')))
      .limit(1);
    if (existing.length > 0) {
      throw new BadRequestException('您已有待审批的上麦申请，请等待管理员审核');
    }

    // 检查是否已经在麦上
    const onMic = await this.db.select().from(chatMicSlots)
      .where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.userId, userId), eq(chatMicSlots.isActive, true)))
      .limit(1);
    if (onMic.length > 0) {
      throw new BadRequestException('您已经在麦上');
    }

    await this.db.insert(chatMicRequests).values({ roomId, userId });
    this.logger.log(`申请上麦: roomId=${roomId}, userId=${userId}`);
    return { success: true, message: '申请已提交，请等待管理员审核' };
  }

  // 获取上麦申请列表
  async getMicRequests(roomId: string, userId: string, isAdmin: boolean) {
    let requests;
    if (isAdmin) {
      // 管理员看所有待审批申请
      requests = await this.db.select().from(chatMicRequests)
        .where(and(eq(chatMicRequests.roomId, roomId), eq(chatMicRequests.status, 'pending')))
        .orderBy(desc(chatMicRequests.createdAt));
    } else {
      // 普通用户看自己的申请
      requests = await this.db.select().from(chatMicRequests)
        .where(and(eq(chatMicRequests.roomId, roomId), eq(chatMicRequests.userId, userId)))
        .orderBy(desc(chatMicRequests.createdAt))
        .limit(5);
    }

    // 查询申请人信息
    const userIds = requests.map((r) => r.userId);
    const userList = userIds.length > 0
      ? await this.db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userList.map((u) => [u.id, u]));

    return {
      items: requests.map((r) => ({
        id: r.id,
        userId: r.userId,
        nickname: userMap.get(r.userId)?.nickname || '未知用户',
        avatarUrl: userMap.get(r.userId)?.avatarUrl,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // 管理员同意上麦申请
  async approveMicRequest(roomId: string, operatorId: string, requestId: string) {
    const requestRows = await this.db.select().from(chatMicRequests).where(eq(chatMicRequests.id, requestId)).limit(1);
    if (requestRows.length === 0) throw new NotFoundException('申请不存在');
    if (requestRows[0].roomId !== roomId) throw new BadRequestException('申请不属于该聊天室');
    if (requestRows[0].status !== 'pending') throw new BadRequestException('该申请已处理');

    await this.db.update(chatMicRequests)
      .set({ status: 'approved', approvedBy: operatorId, updatedAt: new Date() })
      .where(eq(chatMicRequests.id, requestId));

    this.logger.log(`同意上麦申请: roomId=${roomId}, requestId=${requestId}, userId=${requestRows[0].userId}`);
    return { success: true, message: '已同意上麦申请' };
  }

  // 管理员拒绝上麦申请
  async rejectMicRequest(roomId: string, operatorId: string, requestId: string) {
    const requestRows = await this.db.select().from(chatMicRequests).where(eq(chatMicRequests.id, requestId)).limit(1);
    if (requestRows.length === 0) throw new NotFoundException('申请不存在');
    if (requestRows[0].roomId !== roomId) throw new BadRequestException('申请不属于该聊天室');
    if (requestRows[0].status !== 'pending') throw new BadRequestException('该申请已处理');

    await this.db.update(chatMicRequests)
      .set({ status: 'rejected', approvedBy: operatorId, updatedAt: new Date() })
      .where(eq(chatMicRequests.id, requestId));

    this.logger.log(`拒绝上麦申请: roomId=${roomId}, requestId=${requestId}, userId=${requestRows[0].userId}`);
    return { success: true, message: '已拒绝上麦申请' };
  }

  // 上麦（需要管理员先同意申请）
  async takeMic(roomId: string, userId: string, slotIndex?: number) {
    const roomRows = await this.db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
    if (roomRows.length === 0) throw new NotFoundException('聊天室不存在');
    if (roomRows[0].type !== 'public') throw new BadRequestException('个人聊天室无麦位功能');

    // 检查是否有已批准的申请
    const approvedRequest = await this.db.select().from(chatMicRequests)
      .where(and(eq(chatMicRequests.roomId, roomId), eq(chatMicRequests.userId, userId), eq(chatMicRequests.status, 'approved')))
      .limit(1);
    if (approvedRequest.length === 0) {
      throw new BadRequestException('请先申请上麦并等待管理员审核通过');
    }

    // 检查是否已有麦位
    const existing = await this.db.select().from(chatMicSlots).where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.userId, userId), eq(chatMicSlots.isActive, true))).limit(1);
    if (existing.length > 0) {
      return { success: true, slotIndex: existing[0].slotIndex, message: '已在麦上' };
    }

    // 找空麦位
    const allMics = await this.db.select().from(chatMicSlots).where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.isActive, true)));
    const occupiedSlots = new Set(allMics.map((m) => m.slotIndex));
    let targetSlot = slotIndex;
    if (targetSlot === undefined) {
      for (let i = 0; i < 3; i++) {
        if (!occupiedSlots.has(i)) {
          targetSlot = i;
          break;
        }
      }
    }
    if (targetSlot === undefined || occupiedSlots.has(targetSlot)) {
      throw new BadRequestException('麦位已满');
    }

    // 先删除该麦位的旧记录（已下麦的记录），避免唯一索引冲突
    await this.db.delete(chatMicSlots).where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.slotIndex, targetSlot), eq(chatMicSlots.isActive, false)));

    await this.db.insert(chatMicSlots).values({ roomId, userId, slotIndex: targetSlot });
    this.logger.log(`上麦: roomId=${roomId}, userId=${userId}, slot=${targetSlot}`);
    return { success: true, slotIndex: targetSlot };
  }

  // 下麦
  async leaveMic(roomId: string, userId: string) {
    // 直接删除记录，避免唯一索引冲突
    await this.db.delete(chatMicSlots)
      .where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.userId, userId), eq(chatMicSlots.isActive, true)));
    return { success: true };
  }

  // 管理员指定主持人（上麦）
  async assignHost(roomId: string, operatorId: string, targetUserId: string, slotIndex: number) {
    await this.checkPermission(roomId, operatorId);
    // 先把目标用户从当前麦位移除
    await this.db.update(chatMicSlots).set({ isActive: false }).where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.userId, targetUserId)));
    // 把目标麦位的人移除
    await this.db.update(chatMicSlots).set({ isActive: false }).where(and(eq(chatMicSlots.roomId, roomId), eq(chatMicSlots.slotIndex, slotIndex)));
    // 插入新麦位
    await this.db.insert(chatMicSlots).values({ roomId, userId: targetUserId, slotIndex });
    return { success: true };
  }

  // 关闭聊天室（管理员）
  async closeRoom(roomId: string, operatorPhone: string) {
    if (!ADMIN_PHONES.includes(operatorPhone)) {
      throw new ForbiddenException('只有管理员可以关闭聊天室');
    }
    await this.db.update(chatRooms).set({ isActive: false }).where(eq(chatRooms.id, roomId));
    this.logger.log(`关闭聊天室: roomId=${roomId}`);
    return { success: true };
  }

  // 屏蔽词管理
  async getBlockedWords() {
    const words = await this.db.select().from(chatBlockedWords).orderBy(desc(chatBlockedWords.createdAt));
    return { items: words };
  }

  async addBlockedWord(word: string, operatorPhone: string) {
    if (!ADMIN_PHONES.includes(operatorPhone)) throw new ForbiddenException('无权限');
    if (!word || word.trim().length === 0) throw new BadRequestException('屏蔽词不能为空');
    await this.db.insert(chatBlockedWords).values({ word: word.trim() }).catch(() => {});
    return { success: true };
  }

  async removeBlockedWord(id: string, operatorPhone: string) {
    if (!ADMIN_PHONES.includes(operatorPhone)) throw new ForbiddenException('无权限');
    await this.db.delete(chatBlockedWords).where(eq(chatBlockedWords.id, id));
    return { success: true };
  }

  // 过滤屏蔽词
  filterBlockedWords(text: string, blockedWords: string[]): string {
    let result = text;
    for (const word of blockedWords) {
      if (word && result.includes(word)) {
        result = result.split(word).join('*'.repeat(word.length));
      }
    }
    return result;
  }

  // 权限检查
  private async checkPermission(roomId: string, userId: string) {
    const memberRows = await this.db.select().from(chatRoomMembers).where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId))).limit(1);
    if (memberRows.length === 0) throw new ForbiddenException('你不是该聊天室成员');
    const member = memberRows[0];
    if (member.role !== 'owner' && member.role !== 'host') {
      // 检查是否是管理员
      const userRows = await this.db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1);
      if (!ADMIN_PHONES.includes(userRows[0]?.phone || '')) {
        throw new ForbiddenException('无权限操作');
      }
    }
  }

  // 提交聊天室申请
  async createApplication(userId: string, data: { roomName: string; description: string; usageTime: string; contactPhone: string; scheduledStartTime?: string; scheduledEndTime?: string }) {
    // 校验名称长度（12个汉字以内）
    if (data.roomName.length > 12) {
      throw new BadRequestException('聊天室名称不能超过12个汉字');
    }
    // 校验说明长度（50字以内）
    if (data.description.length > 50) {
      throw new BadRequestException('聊天室说明不能超过50字');
    }
    // 校验手机号
    if (!/^1\d{10}$/.test(data.contactPhone)) {
      throw new BadRequestException('请输入正确的11位手机号');
    }

    const result = await this.db.insert(chatRoomApplications).values({
      userId,
      roomName: data.roomName,
      description: data.description,
      usageTime: data.usageTime,
      contactPhone: data.contactPhone,
      scheduledStartTime: data.scheduledStartTime ? new Date(data.scheduledStartTime) : null,
      scheduledEndTime: data.scheduledEndTime ? new Date(data.scheduledEndTime) : null,
    }).returning();

    this.logger.log(`提交聊天室申请: userId=${userId}, roomName=${data.roomName}`);
    return { success: true, application: result[0] };
  }

  // 获取聊天室申请列表
  async getApplications(userId: string, isAdmin: boolean) {
    // 先清理过期申请（超过7天未审批的自动过期）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await this.db.update(chatRoomApplications)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(
        eq(chatRoomApplications.status, 'pending'),
        sql`${chatRoomApplications.createdAt} < ${sevenDaysAgo}`
      ));

    let applications;
    if (isAdmin) {
      // 管理员看所有申请，按创建时间倒序
      applications = await this.db.select().from(chatRoomApplications)
        .orderBy(desc(chatRoomApplications.createdAt))
        .limit(50);
    } else {
      // 普通用户看自己的申请，按创建时间倒序
      applications = await this.db.select().from(chatRoomApplications)
        .where(eq(chatRoomApplications.userId, userId))
        .orderBy(desc(chatRoomApplications.createdAt))
        .limit(20);
    }

    // 查询申请人信息
    const userIds = applications.map((a) => a.userId);
    const userList = userIds.length > 0
      ? await this.db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userList.map((u) => [u.id, u]));

    return {
      items: applications.map((a) => ({
        id: a.id,
        userId: a.userId,
        nickname: userMap.get(a.userId)?.nickname || '未知用户',
        avatarUrl: userMap.get(a.userId)?.avatarUrl,
        roomName: a.roomName,
        description: a.description,
        usageTime: a.usageTime,
        contactPhone: a.contactPhone,
        status: a.status,
        roomId: a.roomId,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  // 管理员同意聊天室申请并创建聊天室
  async approveApplication(operatorId: string, applicationId: string, updateData?: { roomName?: string; description?: string }) {
    const appRows = await this.db.select().from(chatRoomApplications).where(eq(chatRoomApplications.id, applicationId)).limit(1);
    if (appRows.length === 0) throw new NotFoundException('申请不存在');
    if (appRows[0].status !== 'pending') throw new BadRequestException('该申请已处理');

    const finalRoomName = updateData?.roomName || appRows[0].roomName;
    const finalDescription = updateData?.description || appRows[0].description;
    const scheduledStart = appRows[0].scheduledStartTime;
    const scheduledEnd = appRows[0].scheduledEndTime;
    const now = new Date();
    // 如果定时开始时间在未来，聊天室先不激活，到时间自动上线
    const isActive = !scheduledStart || scheduledStart <= now;

    // 创建聊天室
    const roomResult = await this.db.insert(chatRooms).values({
      name: finalRoomName,
      description: finalDescription,
      type: 'public',
      createdBy: appRows[0].userId,
      isActive,
      scheduledStartTime: scheduledStart,
      scheduledEndTime: scheduledEnd,
    }).returning();

    const roomId = roomResult[0].id;

    // 添加创建者为聊天室成员（owner角色）
    await this.db.insert(chatRoomMembers).values({
      roomId,
      userId: appRows[0].userId,
      role: 'owner',
    });

    // 更新申请状态和修改后的名称说明
    await this.db.update(chatRoomApplications)
      .set({ 
        status: 'approved', 
        approvedBy: operatorId, 
        roomId, 
        roomName: finalRoomName,
        description: finalDescription,
        updatedAt: new Date() 
      })
      .where(eq(chatRoomApplications.id, applicationId));

    this.logger.log(`同意聊天室申请: applicationId=${applicationId}, roomId=${roomId}, roomName=${finalRoomName}, isActive=${isActive}`);
    return { success: true, roomId, message: isActive ? '聊天室已创建并上线' : '聊天室已创建，将在指定时间自动上线' };
  }

  // 管理员拒绝聊天室申请
  async rejectApplication(operatorId: string, applicationId: string) {
    const appRows = await this.db.select().from(chatRoomApplications).where(eq(chatRoomApplications.id, applicationId)).limit(1);
    if (appRows.length === 0) throw new NotFoundException('申请不存在');
    if (appRows[0].status !== 'pending') throw new BadRequestException('该申请已处理');

    await this.db.update(chatRoomApplications)
      .set({ status: 'rejected', approvedBy: operatorId, updatedAt: new Date() })
      .where(eq(chatRoomApplications.id, applicationId));

    this.logger.log(`拒绝聊天室申请: applicationId=${applicationId}, roomName=${appRows[0].roomName}`);
    return { success: true, message: '已拒绝申请' };
  }
}
