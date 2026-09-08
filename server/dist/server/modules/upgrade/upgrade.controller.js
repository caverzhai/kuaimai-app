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
exports.UpgradeController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("@server/common/guards/auth.guard");
const upgrade_service_1 = require("./upgrade.service");
let UpgradeController = class UpgradeController {
    upgradeService;
    constructor(upgradeService) {
        this.upgradeService = upgradeService;
    }
    async getUpgradeCenter(req) {
        const userId = req.user.userId;
        return this.upgradeService.getUpgradeCenter(userId);
    }
    async startTask(taskId, req) {
        const userId = req.user.userId;
        return this.upgradeService.startTask(taskId, userId);
    }
};
exports.UpgradeController = UpgradeController;
__decorate([
    (0, common_1.Get)('center'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UpgradeController.prototype, "getUpgradeCenter", null);
__decorate([
    (0, common_1.Post)('tasks/:taskId/start'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UpgradeController.prototype, "startTask", null);
exports.UpgradeController = UpgradeController = __decorate([
    (0, common_1.Controller)('api/upgrade'),
    __metadata("design:paramtypes", [upgrade_service_1.UpgradeService])
], UpgradeController);
//# sourceMappingURL=upgrade.controller.js.map