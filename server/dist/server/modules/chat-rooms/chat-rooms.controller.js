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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRoomsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/guards/auth.guard");
const chat_rooms_service_1 = require("./chat-rooms.service");
let ChatRoomsController = class ChatRoomsController {
    chatRoomsService;
    constructor(chatRoomsService) {
        this.chatRoomsService = chatRoomsService;
    }
    async getRoomList(req) {
        return this.chatRoomsService.getRoomList(req.user.userId);
    }
    async createRoom(req, body) {
        return this.chatRoomsService.createRoom(req.user.userId, req.user.phone, body);
    }
    async createApplication(req, body) {
        return this.chatRoomsService.createApplication(req.user.userId, body);
    }
    async getApplications(req) {
        const isAdmin = req.user.phone === '13800000000';
        return this.chatRoomsService.getApplications(req.user.userId, isAdmin);
    }
    async approveApplication(id, req, body) {
        return this.chatRoomsService.approveApplication(req.user.userId, id, body);
    }
    async rejectApplication(id, req) {
        return this.chatRoomsService.rejectApplication(req.user.userId, id);
    }
    async deleteApplication(id, req) {
        return this.chatRoomsService.deleteApplication(id, req.user.userId, req.user.phone);
    }
    async getAllRoomsForAdmin(req) {
        if (req.user.phone !== '13800000000') {
            throw new common_1.ForbiddenException('仅管理员可访问');
        }
        return this.chatRoomsService.getAllRoomsForAdmin();
    }
    async deleteRoomByAdmin(id, req) {
        if (req.user.phone !== '13800000000') {
            throw new common_1.ForbiddenException('仅管理员可操作');
        }
        return this.chatRoomsService.deleteRoomByAdmin(id, req.user.phone);
    }
    async getRoomDetail(id, req) {
        return this.chatRoomsService.getRoomDetail(id, req.user.userId);
    }
    async getRoomMembers(id, req) {
        return this.chatRoomsService.getRoomMembers(id, req.user.userId);
    }
    async muteUser(id, req, body) {
        return this.chatRoomsService.muteUser(id, req.user.userId, body.userId, body.muted);
    }
    async blockUser(id, req, body) {
        return this.chatRoomsService.blockUser(id, req.user.userId, body.userId, body.blocked);
    }
    async requestMic(id, req) {
        return this.chatRoomsService.requestMic(id, req.user.userId);
    }
    async getMicRequests(id, req) {
        const isAdmin = req.user.phone === '13800000000';
        return this.chatRoomsService.getMicRequests(id, req.user.userId, isAdmin);
    }
    async approveMicRequest(id, requestId, req) {
        return this.chatRoomsService.approveMicRequest(id, req.user.userId, requestId);
    }
    async rejectMicRequest(id, requestId, req) {
        return this.chatRoomsService.rejectMicRequest(id, req.user.userId, requestId);
    }
    async takeMic(id, req, body) {
        return this.chatRoomsService.takeMic(id, req.user.userId, body?.slotIndex);
    }
    async leaveMic(id, req) {
        return this.chatRoomsService.leaveMic(id, req.user.userId);
    }
    async assignHost(id, req, body) {
        return this.chatRoomsService.assignHost(id, req.user.userId, body.userId, body.slotIndex);
    }
    async closeRoom(id, req) {
        return this.chatRoomsService.closeRoom(id, req.user.phone, req.user.userId);
    }
    async getBlockedWords() {
        return this.chatRoomsService.getBlockedWords();
    }
    async addBlockedWord(req, body) {
        return this.chatRoomsService.addBlockedWord(body.word, req.user.phone);
    }
    async removeBlockedWord(id, req) {
        return this.chatRoomsService.removeBlockedWord(id, req.user.phone);
    }
};
exports.ChatRoomsController = ChatRoomsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "getRoomList", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Post)('applications'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "createApplication", null);
__decorate([
    (0, common_1.Get)('applications'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "getApplications", null);
__decorate([
    (0, common_1.Post)('applications/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "approveApplication", null);
__decorate([
    (0, common_1.Post)('applications/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "rejectApplication", null);
__decorate([
    (0, common_1.Delete)('applications/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "deleteApplication", null);
__decorate([
    (0, common_1.Get)('admin/all'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "getAllRoomsForAdmin", null);
__decorate([
    (0, common_1.Delete)('admin/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "deleteRoomByAdmin", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "getRoomDetail", null);
__decorate([
    (0, common_1.Get)(':id/members'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "getRoomMembers", null);
__decorate([
    (0, common_1.Post)(':id/mute'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "muteUser", null);
__decorate([
    (0, common_1.Post)(':id/block'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "blockUser", null);
__decorate([
    (0, common_1.Post)(':id/mic/request'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "requestMic", null);
__decorate([
    (0, common_1.Get)(':id/mic/requests'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "getMicRequests", null);
__decorate([
    (0, common_1.Post)(':id/mic/requests/:requestId/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('requestId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "approveMicRequest", null);
__decorate([
    (0, common_1.Post)(':id/mic/requests/:requestId/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('requestId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "rejectMicRequest", null);
__decorate([
    (0, common_1.Post)(':id/mic/take'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "takeMic", null);
__decorate([
    (0, common_1.Post)(':id/mic/leave'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "leaveMic", null);
__decorate([
    (0, common_1.Post)(':id/mic/assign'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "assignHost", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "closeRoom", null);
__decorate([
    (0, common_1.Get)('blocked-words/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "getBlockedWords", null);
__decorate([
    (0, common_1.Post)('blocked-words'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "addBlockedWord", null);
__decorate([
    (0, common_1.Delete)('blocked-words/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatRoomsController.prototype, "removeBlockedWord", null);
exports.ChatRoomsController = ChatRoomsController = __decorate([
    (0, common_1.Controller)('api/chat-rooms'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [chat_rooms_service_1.ChatRoomsService])
], ChatRoomsController);
//# sourceMappingURL=chat-rooms.controller.js.map