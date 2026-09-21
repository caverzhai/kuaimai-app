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
var FriendsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriendsService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../../database/schema");
let FriendsService = FriendsService_1 = class FriendsService {
    db;
    logger = new common_1.Logger(FriendsService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getFriendList(userId) {
        const friendRelations = await this.db
            .select()
            .from(schema_1.friends)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friends.userId, userId), (0, drizzle_orm_1.eq)(schema_1.friends.status, 'accepted')));
        const friendIds = friendRelations.map((f) => f.friendId);
        const friendInfos = friendIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, avatarUrl: schema_1.users.avatarUrl, phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, friendIds))
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
    async getFriendRequests(userId) {
        const requests = await this.db
            .select()
            .from(schema_1.friends)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friends.friendId, userId), (0, drizzle_orm_1.eq)(schema_1.friends.status, 'pending')))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.friends.createdAt));
        const requesterIds = requests.map((r) => r.userId);
        const requesterInfos = requesterIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, avatarUrl: schema_1.users.avatarUrl }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, requesterIds))
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
    async addFriend(userId, friendPhone) {
        if (!friendPhone || friendPhone.trim().length === 0) {
            throw new common_1.BadRequestException('请输入好友手机号');
        }
        const friendRows = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.phone, friendPhone.trim())).limit(1);
        if (friendRows.length === 0)
            throw new common_1.NotFoundException('用户不存在');
        const friend = friendRows[0];
        if (friend.id === userId)
            throw new common_1.BadRequestException('不能添加自己为好友');
        const existing = await this.db
            .select()
            .from(schema_1.friends)
            .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friends.userId, userId), (0, drizzle_orm_1.eq)(schema_1.friends.friendId, friend.id)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friends.userId, friend.id), (0, drizzle_orm_1.eq)(schema_1.friends.friendId, userId))))
            .limit(1);
        if (existing.length > 0) {
            if (existing[0].status === 'accepted') {
                throw new common_1.BadRequestException('已经是好友了');
            }
            else if (existing[0].status === 'pending') {
                throw new common_1.BadRequestException('好友请求已发送，等待对方确认');
            }
        }
        await this.db.insert(schema_1.friends).values({ userId, friendId: friend.id, status: 'pending' });
        this.logger.log(`添加好友请求: userId=${userId}, friendId=${friend.id}`);
        return { success: true, message: '好友请求已发送' };
    }
    async respondFriendRequest(userId, requestId, accept) {
        const requestRows = await this.db.select().from(schema_1.friends).where((0, drizzle_orm_1.eq)(schema_1.friends.id, requestId)).limit(1);
        if (requestRows.length === 0)
            throw new common_1.NotFoundException('请求不存在');
        const request = requestRows[0];
        if (request.friendId !== userId)
            throw new common_1.BadRequestException('无权操作此请求');
        if (request.status !== 'pending')
            throw new common_1.BadRequestException('请求已处理');
        if (accept) {
            await this.db.update(schema_1.friends).set({ status: 'accepted' }).where((0, drizzle_orm_1.eq)(schema_1.friends.id, requestId));
            await this.db.insert(schema_1.friends).values({ userId, friendId: request.userId, status: 'accepted' }).catch(() => { });
            return { success: true, message: '已接受好友请求' };
        }
        else {
            await this.db.update(schema_1.friends).set({ status: 'rejected' }).where((0, drizzle_orm_1.eq)(schema_1.friends.id, requestId));
            return { success: true, message: '已拒绝好友请求' };
        }
    }
    async createPersonalRoom(userId, data) {
        if (!data.memberIds || data.memberIds.length === 0) {
            throw new common_1.BadRequestException('请选择聊天室成员');
        }
        const friendRelations = await this.db
            .select({ friendId: schema_1.friends.friendId })
            .from(schema_1.friends)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friends.userId, userId), (0, drizzle_orm_1.eq)(schema_1.friends.status, 'accepted')));
        const friendIds = new Set(friendRelations.map((f) => f.friendId));
        for (const memberId of data.memberIds) {
            if (memberId !== userId && !friendIds.has(memberId)) {
                throw new common_1.BadRequestException('只能与好友创建聊天室');
            }
        }
        const inserted = await this.db
            .insert(schema_1.chatRooms)
            .values({
            name: data.name || '好友聊天室',
            type: 'personal',
            createdBy: userId,
            maxMicCount: 0,
        })
            .returning();
        const room = inserted[0];
        const allMemberIds = [userId, ...data.memberIds.filter((id) => id !== userId)];
        for (const memberId of allMemberIds) {
            await this.db.insert(schema_1.chatRoomMembers).values({
                roomId: room.id,
                userId: memberId,
                role: memberId === userId ? 'owner' : 'member',
            }).catch(() => { });
        }
        this.logger.log(`创建个人聊天室: roomId=${room.id}, name=${room.name}, members=${allMemberIds.length}`);
        return { id: room.id, name: room.name, type: 'personal' };
    }
};
exports.FriendsService = FriendsService;
exports.FriendsService = FriendsService = FriendsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], FriendsService);
//# sourceMappingURL=friends.service.js.map