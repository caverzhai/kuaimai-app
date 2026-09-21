"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatRoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRoomsService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
const ADMIN_PHONES = ['13800000000'];
let ChatRoomsService = ChatRoomsService_1 = class ChatRoomsService {
    db;
    logger = new common_1.Logger(ChatRoomsService_1.name);
    constructor(db) {
        this.db = db;
        this.startScheduledTask();
    }
    scheduledTimer = null;
    startScheduledTask() {
        if (this.scheduledTimer)
            return;
        this.scheduledTimer = setInterval(async () => {
            try {
                const now = new Date();
                await this.db.execute((0, drizzle_orm_1.sql) `
          UPDATE chat_rooms 
          SET is_active = true, _updated_at = CURRENT_TIMESTAMP
          WHERE is_active = false 
            AND scheduled_start_time IS NOT NULL 
            AND scheduled_start_time <= ${now}
        `);
                await this.db.execute((0, drizzle_orm_1.sql) `
          UPDATE chat_rooms 
          SET is_active = false, _updated_at = CURRENT_TIMESTAMP
          WHERE is_active = true 
            AND scheduled_end_time IS NOT NULL 
            AND scheduled_end_time <= ${now}
        `);
                this.cleanupCounter = (this.cleanupCounter || 0) + 1;
                if (this.cleanupCounter >= 60) {
                    this.cleanupCounter = 0;
                    await this.cleanupExpiredRooms();
                }
            }
            catch (err) {
                this.logger.error('定时任务执行失败', err);
            }
        }, 60000);
    }
    cleanupCounter = 0;
    async getRoomList(userId) {
        const now = new Date();
        const rooms = await this.db
            .select()
            .from(schema_1.chatRooms)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRooms.isActive, true), (0, drizzle_orm_1.sql) `(${schema_1.chatRooms.scheduledEndTime} IS NULL OR ${schema_1.chatRooms.scheduledEndTime} > ${now})`))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.chatRooms.createdAt));
        const roomIds = rooms.map((r) => r.id);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const members = roomIds.length > 0
            ? await this.db.select().from(schema_1.chatRoomMembers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.chatRoomMembers.roomId, roomIds), (0, drizzle_orm_1.gte)(schema_1.chatRoomMembers.lastActiveAt, fiveMinutesAgo)))
            : [];
        const mics = roomIds.length > 0
            ? await this.db.select().from(schema_1.chatMicSlots).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.chatMicSlots.roomId, roomIds), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, true)))
            : [];
        const memberCountMap = new Map();
        const micMap = new Map();
        for (const m of members) {
            memberCountMap.set(m.roomId, (memberCountMap.get(m.roomId) || 0) + 1);
        }
        for (const mic of mics) {
            const list = micMap.get(mic.roomId) || [];
            list.push(mic);
            micMap.set(mic.roomId, list);
        }
        const micUserIds = mics.map((m) => m.userId);
        const micUsers = micUserIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, avatarUrl: schema_1.users.avatarUrl }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, micUserIds))
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
    async createRoom(userId, userPhone, data) {
        const isAdmin = ADMIN_PHONES.includes(userPhone);
        if (data.type === 'public' && !isAdmin) {
            throw new common_1.ForbiddenException('只有管理员可以创建公开聊天室');
        }
        if (!data.name || data.name.trim().length === 0) {
            throw new common_1.BadRequestException('聊天室名称不能为空');
        }
        const maxMicCount = data.type === 'public' ? 3 : 0;
        const inserted = await this.db
            .insert(schema_1.chatRooms)
            .values({
            name: data.name.trim(),
            description: data.description,
            type: data.type,
            createdBy: userId,
            maxMicCount,
        })
            .returning();
        const room = inserted[0];
        await this.db.insert(schema_1.chatRoomMembers).values({
            roomId: room.id,
            userId,
            role: 'owner',
        });
        if (data.type === 'personal' && data.memberIds) {
            for (const memberId of data.memberIds) {
                if (memberId !== userId) {
                    await this.db.insert(schema_1.chatRoomMembers).values({
                        roomId: room.id,
                        userId: memberId,
                        role: 'member',
                    }).catch(() => { });
                }
            }
        }
        this.logger.log(`创建聊天室: roomId=${room.id}, name=${room.name}, type=${data.type}`);
        return { id: room.id, name: room.name, type: room.type };
    }
    async getRoomDetail(roomId, userId) {
        const roomRows = await this.db.select().from(schema_1.chatRooms).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId)).limit(1);
        if (roomRows.length === 0)
            throw new common_1.NotFoundException('聊天室不存在');
        const room = roomRows[0];
        const memberRows = await this.db.select().from(schema_1.chatRoomMembers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, userId))).limit(1);
        let member = memberRows[0];
        if (!member && room.type === 'public') {
            await this.db.insert(schema_1.chatRoomMembers).values({ roomId, userId, role: 'member', lastActiveAt: new Date() });
            member = { roomId, userId, role: 'member', isMuted: false, isBlocked: false, lastActiveAt: new Date() };
        }
        else if (member) {
            await this.db.update(schema_1.chatRoomMembers)
                .set({ lastActiveAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, userId)));
        }
        if (!member) {
            throw new common_1.ForbiddenException('你不是该聊天室成员');
        }
        if (member.isBlocked) {
            throw new common_1.ForbiddenException('你已被拉黑，无法进入该聊天室');
        }
        const mics = await this.db.select().from(schema_1.chatMicSlots).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, true)));
        const micUserIds = mics.map((m) => m.userId);
        const micUsers = micUserIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, avatarUrl: schema_1.users.avatarUrl }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, micUserIds))
            : [];
        const micUserMap = new Map(micUsers.map((u) => [u.id, u]));
        return {
            id: room.id,
            name: room.name,
            description: room.description,
            type: room.type,
            maxMicCount: room.maxMicCount,
            isActive: room.isActive,
            scheduledEndTime: room.scheduledEndTime ? room.scheduledEndTime.toISOString() : null,
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
    async getRoomMembers(roomId, userId) {
        const roomRows = await this.db.select().from(schema_1.chatRooms).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId)).limit(1);
        if (roomRows.length === 0)
            throw new common_1.NotFoundException('聊天室不存在');
        const myMember = await this.db.select().from(schema_1.chatRoomMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, userId)))
            .limit(1);
        if (myMember.length === 0) {
            throw new common_1.ForbiddenException('你不是该聊天室成员');
        }
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const members = await this.db.select().from(schema_1.chatRoomMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.isBlocked, false), (0, drizzle_orm_1.gte)(schema_1.chatRoomMembers.lastActiveAt, fiveMinutesAgo)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.chatRoomMembers.lastActiveAt));
        const memberUserIds = members.map((m) => m.userId);
        const memberUsers = memberUserIds.length > 0
            ? await this.db.select({
                id: schema_1.users.id,
                nickname: schema_1.users.nickname,
                avatarUrl: schema_1.users.avatarUrl,
                level: schema_1.users.level,
            }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, memberUserIds))
            : [];
        const userMap = new Map(memberUsers.map((u) => [u.id, u]));
        const mics = await this.db.select().from(schema_1.chatMicSlots)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, true)));
        const micUserIds = new Set(mics.map((m) => m.userId));
        const items = members.map((member) => {
            const user = userMap.get(member.userId);
            return {
                userId: member.userId,
                nickname: user?.nickname || '未知用户',
                avatarUrl: user?.avatarUrl,
                level: user?.level,
                role: member.role,
                isMuted: member.isMuted,
                isOnMic: micUserIds.has(member.userId),
                joinedAt: member.joinedAt.toISOString(),
            };
        });
        return {
            items,
            total: items.length,
        };
    }
    async muteUser(roomId, operatorId, targetUserId, muted) {
        await this.checkPermission(roomId, operatorId);
        await this.db.update(schema_1.chatRoomMembers)
            .set({ isMuted: muted })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, targetUserId)));
        this.logger.log(`禁言操作: roomId=${roomId}, targetUserId=${targetUserId}, muted=${muted}`);
        return { success: true };
    }
    async blockUser(roomId, operatorId, targetUserId, blocked) {
        await this.checkPermission(roomId, operatorId);
        await this.db.update(schema_1.chatRoomMembers)
            .set({ isBlocked: blocked })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, targetUserId)));
        this.logger.log(`拉黑操作: roomId=${roomId}, targetUserId=${targetUserId}, blocked=${blocked}`);
        return { success: true };
    }
    async requestMic(roomId, userId) {
        const roomRows = await this.db.select().from(schema_1.chatRooms).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId)).limit(1);
        if (roomRows.length === 0)
            throw new common_1.NotFoundException('聊天室不存在');
        if (roomRows[0].type !== 'public')
            throw new common_1.BadRequestException('个人聊天室无麦位功能');
        const existing = await this.db.select().from(schema_1.chatMicRequests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicRequests.userId, userId), (0, drizzle_orm_1.eq)(schema_1.chatMicRequests.status, 'pending')))
            .limit(1);
        if (existing.length > 0) {
            throw new common_1.BadRequestException('您已有待审批的上麦申请，请等待管理员审核');
        }
        const onMic = await this.db.select().from(schema_1.chatMicSlots)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.userId, userId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, true)))
            .limit(1);
        if (onMic.length > 0) {
            throw new common_1.BadRequestException('您已经在麦上');
        }
        await this.db.insert(schema_1.chatMicRequests).values({ roomId, userId });
        this.logger.log(`申请上麦: roomId=${roomId}, userId=${userId}`);
        return { success: true, message: '申请已提交，请等待管理员审核' };
    }
    async getMicRequests(roomId, userId, isAdmin) {
        let requests;
        if (isAdmin) {
            requests = await this.db.select().from(schema_1.chatMicRequests)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicRequests.status, 'pending')))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.chatMicRequests.createdAt));
        }
        else {
            requests = await this.db.select().from(schema_1.chatMicRequests)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicRequests.userId, userId)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.chatMicRequests.createdAt))
                .limit(5);
        }
        const userIds = requests.map((r) => r.userId);
        const userList = userIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, avatarUrl: schema_1.users.avatarUrl }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds))
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
    async approveMicRequest(roomId, operatorId, requestId) {
        const requestRows = await this.db.select().from(schema_1.chatMicRequests).where((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.id, requestId)).limit(1);
        if (requestRows.length === 0)
            throw new common_1.NotFoundException('申请不存在');
        if (requestRows[0].roomId !== roomId)
            throw new common_1.BadRequestException('申请不属于该聊天室');
        if (requestRows[0].status !== 'pending')
            throw new common_1.BadRequestException('该申请已处理');
        await this.db.update(schema_1.chatMicRequests)
            .set({ status: 'approved', approvedBy: operatorId, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.id, requestId));
        this.logger.log(`同意上麦申请: roomId=${roomId}, requestId=${requestId}, userId=${requestRows[0].userId}`);
        return { success: true, message: '已同意上麦申请' };
    }
    async rejectMicRequest(roomId, operatorId, requestId) {
        const requestRows = await this.db.select().from(schema_1.chatMicRequests).where((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.id, requestId)).limit(1);
        if (requestRows.length === 0)
            throw new common_1.NotFoundException('申请不存在');
        if (requestRows[0].roomId !== roomId)
            throw new common_1.BadRequestException('申请不属于该聊天室');
        if (requestRows[0].status !== 'pending')
            throw new common_1.BadRequestException('该申请已处理');
        await this.db.update(schema_1.chatMicRequests)
            .set({ status: 'rejected', approvedBy: operatorId, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.id, requestId));
        this.logger.log(`拒绝上麦申请: roomId=${roomId}, requestId=${requestId}, userId=${requestRows[0].userId}`);
        return { success: true, message: '已拒绝上麦申请' };
    }
    async takeMic(roomId, userId, slotIndex) {
        const roomRows = await this.db.select().from(schema_1.chatRooms).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId)).limit(1);
        if (roomRows.length === 0)
            throw new common_1.NotFoundException('聊天室不存在');
        if (roomRows[0].type !== 'public')
            throw new common_1.BadRequestException('个人聊天室无麦位功能');
        const approvedRequest = await this.db.select().from(schema_1.chatMicRequests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicRequests.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicRequests.userId, userId), (0, drizzle_orm_1.eq)(schema_1.chatMicRequests.status, 'approved')))
            .limit(1);
        if (approvedRequest.length === 0) {
            throw new common_1.BadRequestException('请先申请上麦并等待管理员审核通过');
        }
        const existing = await this.db.select().from(schema_1.chatMicSlots).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.userId, userId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, true))).limit(1);
        if (existing.length > 0) {
            return { success: true, slotIndex: existing[0].slotIndex, message: '已在麦上' };
        }
        const allMics = await this.db.select().from(schema_1.chatMicSlots).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, true)));
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
            throw new common_1.BadRequestException('麦位已满');
        }
        await this.db.delete(schema_1.chatMicSlots).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.slotIndex, targetSlot), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, false)));
        await this.db.insert(schema_1.chatMicSlots).values({ roomId, userId, slotIndex: targetSlot });
        this.logger.log(`上麦: roomId=${roomId}, userId=${userId}, slot=${targetSlot}`);
        return { success: true, slotIndex: targetSlot };
    }
    async leaveMic(roomId, userId) {
        await this.db.delete(schema_1.chatMicSlots)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.userId, userId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.isActive, true)));
        return { success: true };
    }
    async assignHost(roomId, operatorId, targetUserId, slotIndex) {
        await this.checkPermission(roomId, operatorId);
        await this.db.update(schema_1.chatMicSlots).set({ isActive: false }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.userId, targetUserId)));
        await this.db.update(schema_1.chatMicSlots).set({ isActive: false }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatMicSlots.slotIndex, slotIndex)));
        await this.db.insert(schema_1.chatMicSlots).values({ roomId, userId: targetUserId, slotIndex });
        return { success: true };
    }
    async closeRoom(roomId, operatorPhone, operatorUserId) {
        const room = await this.db.select().from(schema_1.chatRooms).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId)).limit(1);
        if (room.length === 0) {
            throw new common_1.NotFoundException('聊天室不存在');
        }
        const isAdmin = ADMIN_PHONES.includes(operatorPhone);
        const isCreator = room[0].createdBy === operatorUserId;
        if (!isAdmin && !isCreator) {
            throw new common_1.ForbiddenException('只有管理员或聊天室创建者可以关闭聊天室');
        }
        await this.db.update(schema_1.chatRooms).set({ isActive: false }).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId));
        this.logger.log(`关闭聊天室: roomId=${roomId}, operator=${operatorPhone}, isAdmin=${isAdmin}, isCreator=${isCreator}`);
        return { success: true };
    }
    async activateScheduledRooms() {
        const now = new Date();
        try {
            const result = await this.db
                .update(schema_1.chatRooms)
                .set({ isActive: true })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRooms.isActive, false), (0, drizzle_orm_1.sql) `${schema_1.chatRooms.scheduledStartTime} IS NOT NULL`, (0, drizzle_orm_1.sql) `${schema_1.chatRooms.scheduledStartTime} <= ${now}`))
                .returning({ id: schema_1.chatRooms.id });
            if (result.length > 0) {
                this.logger.log(`定时激活聊天室: ${result.length} 个`);
            }
            return { activated: result.length };
        }
        catch (e) {
            this.logger.error(`定时激活聊天室失败: ${e}`);
            return { activated: 0 };
        }
    }
    async closeExpiredRooms() {
        const now = new Date();
        try {
            const result = await this.db
                .update(schema_1.chatRooms)
                .set({ isActive: false })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRooms.isActive, true), (0, drizzle_orm_1.sql) `${schema_1.chatRooms.scheduledEndTime} IS NOT NULL`, (0, drizzle_orm_1.sql) `${schema_1.chatRooms.scheduledEndTime} <= ${now}`))
                .returning({ id: schema_1.chatRooms.id });
            if (result.length > 0) {
                this.logger.log(`定时关闭过期聊天室: ${result.length} 个`);
            }
            return { closed: result.length };
        }
        catch (e) {
            this.logger.error(`定时关闭过期聊天室失败: ${e}`);
            return { closed: 0 };
        }
    }
    async getAllRoomsForAdmin() {
        const rooms = await this.db
            .select({
            id: schema_1.chatRooms.id,
            name: schema_1.chatRooms.name,
            description: schema_1.chatRooms.description,
            type: schema_1.chatRooms.type,
            createdBy: schema_1.chatRooms.createdBy,
            isActive: schema_1.chatRooms.isActive,
            scheduledStartTime: schema_1.chatRooms.scheduledStartTime,
            scheduledEndTime: schema_1.chatRooms.scheduledEndTime,
            createdAt: schema_1.chatRooms.createdAt,
        })
            .from(schema_1.chatRooms)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.chatRooms.createdAt));
        const userIds = rooms.map((r) => r.createdBy);
        const creators = userIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds))
            : [];
        const creatorMap = new Map(creators.map((u) => [u.id, u]));
        return {
            items: rooms.map((room) => ({
                ...room,
                creatorNickname: creatorMap.get(room.createdBy)?.nickname || '未知',
                creatorPhone: creatorMap.get(room.createdBy)?.phone || '',
                scheduledStartTime: room.scheduledStartTime ? room.scheduledStartTime.toISOString() : null,
                scheduledEndTime: room.scheduledEndTime ? room.scheduledEndTime.toISOString() : null,
                createdAt: room.createdAt.toISOString(),
                isExpired: room.scheduledEndTime ? new Date(room.scheduledEndTime) < new Date() : false,
            })),
        };
    }
    async deleteRoomByAdmin(roomId, operatorPhone) {
        await this.db.delete(schema_1.chatRoomMembers).where((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId));
        await this.db.delete(schema_1.chatMicSlots).where((0, drizzle_orm_1.eq)(schema_1.chatMicSlots.roomId, roomId));
        await this.db.delete(schema_1.chatMessages).where((0, drizzle_orm_1.eq)(schema_1.chatMessages.roomId, roomId));
        const result = await this.db.delete(schema_1.chatRooms).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId)).returning({ id: schema_1.chatRooms.id });
        this.logger.log(`管理员${operatorPhone}删除聊天室: ${roomId}`);
        return { success: result.length > 0 };
    }
    async cleanupExpiredRooms() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        try {
            const expiredRooms = await this.db
                .select({ id: schema_1.chatRooms.id })
                .from(schema_1.chatRooms)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRooms.isActive, false), (0, drizzle_orm_1.sql) `${schema_1.chatRooms.scheduledEndTime} IS NOT NULL`, (0, drizzle_orm_1.sql) `${schema_1.chatRooms.scheduledEndTime} <= ${cutoffTime}`));
            if (expiredRooms.length === 0)
                return { deleted: 0 };
            const roomIds = expiredRooms.map((r) => r.id);
            await this.db.delete(schema_1.chatRoomMembers).where((0, drizzle_orm_1.inArray)(schema_1.chatRoomMembers.roomId, roomIds));
            await this.db.delete(schema_1.chatMicSlots).where((0, drizzle_orm_1.inArray)(schema_1.chatMicSlots.roomId, roomIds));
            await this.db.delete(schema_1.chatMessages).where((0, drizzle_orm_1.inArray)(schema_1.chatMessages.roomId, roomIds));
            await this.db.delete(schema_1.chatRooms).where((0, drizzle_orm_1.inArray)(schema_1.chatRooms.id, roomIds));
            this.logger.log(`自动清理已结束超过24小时的聊天室: ${roomIds.length} 个`);
            return { deleted: roomIds.length };
        }
        catch (e) {
            this.logger.error(`自动清理过期聊天室失败: ${e}`);
            return { deleted: 0 };
        }
    }
    async getBlockedWords() {
        const words = await this.db.select().from(schema_1.chatBlockedWords).orderBy((0, drizzle_orm_1.desc)(schema_1.chatBlockedWords.createdAt));
        return { items: words };
    }
    async addBlockedWord(word, operatorPhone) {
        if (!ADMIN_PHONES.includes(operatorPhone))
            throw new common_1.ForbiddenException('无权限');
        if (!word || word.trim().length === 0)
            throw new common_1.BadRequestException('屏蔽词不能为空');
        await this.db.insert(schema_1.chatBlockedWords).values({ word: word.trim() }).catch(() => { });
        return { success: true };
    }
    async removeBlockedWord(id, operatorPhone) {
        if (!ADMIN_PHONES.includes(operatorPhone))
            throw new common_1.ForbiddenException('无权限');
        await this.db.delete(schema_1.chatBlockedWords).where((0, drizzle_orm_1.eq)(schema_1.chatBlockedWords.id, id));
        return { success: true };
    }
    filterBlockedWords(text, blockedWords) {
        let result = text;
        for (const word of blockedWords) {
            if (word && result.includes(word)) {
                result = result.split(word).join('*'.repeat(word.length));
            }
        }
        return result;
    }
    async checkPermission(roomId, userId) {
        const memberRows = await this.db.select().from(schema_1.chatRoomMembers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, userId))).limit(1);
        if (memberRows.length === 0)
            throw new common_1.ForbiddenException('你不是该聊天室成员');
        const member = memberRows[0];
        if (member.role !== 'owner' && member.role !== 'host') {
            const userRows = await this.db.select({ phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
            if (!ADMIN_PHONES.includes(userRows[0]?.phone || '')) {
                throw new common_1.ForbiddenException('无权限操作');
            }
        }
    }
    async createApplication(userId, data) {
        if (data.roomName.length > 12) {
            throw new common_1.BadRequestException('聊天室名称不能超过12个汉字');
        }
        if (data.description.length > 50) {
            throw new common_1.BadRequestException('聊天室说明不能超过50字');
        }
        if (!/^1\d{10}$/.test(data.contactPhone)) {
            throw new common_1.BadRequestException('请输入正确的11位手机号');
        }
        const result = await this.db.insert(schema_1.chatRoomApplications).values({
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
    async getApplications(userId, isAdmin) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await this.db.update(schema_1.chatRoomApplications)
            .set({ status: 'expired', updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.status, 'pending'), (0, drizzle_orm_1.sql) `${schema_1.chatRoomApplications.createdAt} < ${sevenDaysAgo}`));
        let applications;
        if (isAdmin) {
            applications = await this.db.select().from(schema_1.chatRoomApplications)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.chatRoomApplications.createdAt))
                .limit(50);
        }
        else {
            applications = await this.db.select().from(schema_1.chatRoomApplications)
                .where((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.userId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.chatRoomApplications.createdAt))
                .limit(20);
        }
        const userIds = applications.map((a) => a.userId);
        const userList = userIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, avatarUrl: schema_1.users.avatarUrl }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds))
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
    async approveApplication(operatorId, applicationId, updateData) {
        const appRows = await this.db.select().from(schema_1.chatRoomApplications).where((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.id, applicationId)).limit(1);
        if (appRows.length === 0)
            throw new common_1.NotFoundException('申请不存在');
        if (appRows[0].status !== 'pending')
            throw new common_1.BadRequestException('该申请已处理');
        const finalRoomName = updateData?.roomName || appRows[0].roomName;
        const finalDescription = updateData?.description || appRows[0].description;
        const scheduledStart = appRows[0].scheduledStartTime;
        const scheduledEnd = appRows[0].scheduledEndTime;
        const now = new Date();
        const isActive = !scheduledStart || scheduledStart <= now;
        const roomResult = await this.db.insert(schema_1.chatRooms).values({
            name: finalRoomName,
            description: finalDescription,
            type: 'public',
            createdBy: appRows[0].userId,
            isActive,
            scheduledStartTime: scheduledStart,
            scheduledEndTime: scheduledEnd,
        }).returning();
        const roomId = roomResult[0].id;
        await this.db.insert(schema_1.chatRoomMembers).values({
            roomId,
            userId: appRows[0].userId,
            role: 'owner',
        });
        await this.db.update(schema_1.chatRoomApplications)
            .set({
            status: 'approved',
            approvedBy: operatorId,
            roomId,
            roomName: finalRoomName,
            description: finalDescription,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.id, applicationId));
        this.logger.log(`同意聊天室申请: applicationId=${applicationId}, roomId=${roomId}, roomName=${finalRoomName}, isActive=${isActive}`);
        return { success: true, roomId, message: isActive ? '聊天室已创建并上线' : '聊天室已创建，将在指定时间自动上线' };
    }
    async rejectApplication(operatorId, applicationId) {
        const appRows = await this.db.select().from(schema_1.chatRoomApplications).where((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.id, applicationId)).limit(1);
        if (appRows.length === 0)
            throw new common_1.NotFoundException('申请不存在');
        if (appRows[0].status !== 'pending')
            throw new common_1.BadRequestException('该申请已处理');
        await this.db.update(schema_1.chatRoomApplications)
            .set({ status: 'rejected', approvedBy: operatorId, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.id, applicationId));
        this.logger.log(`拒绝聊天室申请: applicationId=${applicationId}, roomName=${appRows[0].roomName}`);
        return { success: true, message: '已拒绝申请' };
    }
    async deleteApplication(applicationId, userId, userPhone) {
        const isAdmin = ADMIN_PHONES.includes(userPhone);
        const appRows = await this.db.select().from(schema_1.chatRoomApplications).where((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.id, applicationId)).limit(1);
        if (appRows.length === 0)
            throw new common_1.NotFoundException('申请不存在');
        if (!isAdmin && appRows[0].userId !== userId) {
            throw new common_1.ForbiddenException('只能删除自己的申请记录');
        }
        await this.db.delete(schema_1.chatRoomApplications).where((0, drizzle_orm_1.eq)(schema_1.chatRoomApplications.id, applicationId));
        this.logger.log(`删除聊天室申请: applicationId=${applicationId}, roomName=${appRows[0].roomName}, by=${userPhone}`);
        return { success: true, message: '申请记录已删除' };
    }
};
exports.ChatRoomsService = ChatRoomsService;
exports.ChatRoomsService = ChatRoomsService = ChatRoomsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], ChatRoomsService);
//# sourceMappingURL=chat-rooms.service.js.map