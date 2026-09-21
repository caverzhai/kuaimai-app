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
var ChatMessagesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessagesService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../../database/schema");
const chat_rooms_service_1 = require("../chat-rooms/chat-rooms.service");
const MESSAGE_EXPIRE_MINUTES = 30;
let ChatMessagesService = ChatMessagesService_1 = class ChatMessagesService {
    db;
    chatRoomsService;
    logger = new common_1.Logger(ChatMessagesService_1.name);
    constructor(db, chatRoomsService) {
        this.db = db;
        this.chatRoomsService = chatRoomsService;
    }
    async sendMessage(roomId, userId, data) {
        const roomRows = await this.db.select().from(schema_1.chatRooms).where((0, drizzle_orm_1.eq)(schema_1.chatRooms.id, roomId)).limit(1);
        if (roomRows.length === 0)
            throw new common_1.NotFoundException('聊天室不存在');
        if (!roomRows[0].isActive)
            throw new common_1.BadRequestException('聊天室已关闭');
        const memberRows = await this.db.select().from(schema_1.chatRoomMembers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, userId))).limit(1);
        if (memberRows.length === 0)
            throw new common_1.ForbiddenException('你不是该聊天室成员');
        if (memberRows[0].isBlocked)
            throw new common_1.ForbiddenException('你已被拉黑');
        if (memberRows[0].isMuted && data.type === 'text')
            throw new common_1.ForbiddenException('你已被禁言');
        if (!data.content || data.content.trim().length === 0) {
            throw new common_1.BadRequestException('消息内容不能为空');
        }
        let content = data.content;
        if (data.type === 'text') {
            const blockedWords = await this.db.select({ word: schema_1.chatBlockedWords.word }).from(schema_1.chatBlockedWords);
            content = this.chatRoomsService.filterBlockedWords(content, blockedWords.map((w) => w.word));
        }
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + MESSAGE_EXPIRE_MINUTES);
        const inserted = await this.db
            .insert(schema_1.chatMessages)
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
    async getMessages(roomId, userId, limit = 50) {
        const memberRows = await this.db.select().from(schema_1.chatRoomMembers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(schema_1.chatRoomMembers.userId, userId))).limit(1);
        if (memberRows.length === 0)
            throw new common_1.ForbiddenException('你不是该聊天室成员');
        const now = new Date();
        const messages = await this.db
            .select()
            .from(schema_1.chatMessages)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.chatMessages.roomId, roomId), (0, drizzle_orm_1.gt)(schema_1.chatMessages.expiresAt, now)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.chatMessages.createdAt))
            .limit(limit);
        const userIds = [...new Set(messages.map((m) => m.userId))];
        const userInfos = userIds.length > 0
            ? await this.db.select({ id: schema_1.users.id, nickname: schema_1.users.nickname, avatarUrl: schema_1.users.avatarUrl }).from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds))
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
    async cleanExpiredMessages() {
        const now = new Date();
        const deleted = await this.db
            .delete(schema_1.chatMessages)
            .where(lt(schema_1.chatMessages.expiresAt, now))
            .returning({ id: schema_1.chatMessages.id });
        this.logger.log(`清理过期消息: ${deleted.length} 条`);
        return { cleaned: deleted.length };
    }
};
exports.ChatMessagesService = ChatMessagesService;
exports.ChatMessagesService = ChatMessagesService = ChatMessagesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, chat_rooms_service_1.ChatRoomsService])
], ChatMessagesService);
function lt(column, value) {
    return (0, drizzle_orm_1.sql) `${column} < ${value}`;
}
//# sourceMappingURL=chat-messages.service.js.map