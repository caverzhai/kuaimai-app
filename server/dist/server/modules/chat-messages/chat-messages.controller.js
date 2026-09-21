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
exports.ChatMessagesController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("@server/common/guards/auth.guard");
const chat_messages_service_1 = require("./chat-messages.service");
let ChatMessagesController = class ChatMessagesController {
    chatMessagesService;
    constructor(chatMessagesService) {
        this.chatMessagesService = chatMessagesService;
    }
    async sendMessage(roomId, req, body) {
        return this.chatMessagesService.sendMessage(roomId, req.user.userId, body);
    }
    async getMessages(roomId, req, limit) {
        return this.chatMessagesService.getMessages(roomId, req.user.userId, limit ? parseInt(limit, 10) : 50);
    }
};
exports.ChatMessagesController = ChatMessagesController;
__decorate([
    (0, common_1.Post)(':roomId'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatMessagesController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)(':roomId'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ChatMessagesController.prototype, "getMessages", null);
exports.ChatMessagesController = ChatMessagesController = __decorate([
    (0, common_1.Controller)('api/chat-messages'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [chat_messages_service_1.ChatMessagesService])
], ChatMessagesController);
//# sourceMappingURL=chat-messages.controller.js.map