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
exports.MallOrdersController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("@server/common/guards/auth.guard");
const mall_orders_service_1 = require("./mall-orders.service");
let MallOrdersController = class MallOrdersController {
    mallOrdersService;
    constructor(mallOrdersService) {
        this.mallOrdersService = mallOrdersService;
    }
    async create(req, dto) {
        const userId = req.user.userId;
        return this.mallOrdersService.create(userId, dto);
    }
    async getMyOrders(req, page = '1', pageSize = '10', status) {
        const userId = req.user.userId;
        return this.mallOrdersService.getMyOrders(userId, parseInt(page, 10), parseInt(pageSize, 10), status);
    }
    async getDetail(req, id) {
        const userId = req.user.userId;
        return this.mallOrdersService.getOrderDetail(userId, id);
    }
    async uploadPayment(req, id, dto) {
        const userId = req.user.userId;
        return this.mallOrdersService.uploadPaymentScreenshot(userId, id, dto);
    }
    async confirmDelivery(req, id) {
        const userId = req.user.userId;
        return this.mallOrdersService.confirmDelivery(userId, id);
    }
};
exports.MallOrdersController = MallOrdersController;
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MallOrdersController.prototype, "create", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)('my'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], MallOrdersController.prototype, "getMyOrders", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MallOrdersController.prototype, "getDetail", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Post)(':id/payment'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MallOrdersController.prototype, "uploadPayment", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Post)(':id/confirm-delivery'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MallOrdersController.prototype, "confirmDelivery", null);
exports.MallOrdersController = MallOrdersController = __decorate([
    (0, common_1.Controller)('api/mall-orders'),
    __metadata("design:paramtypes", [mall_orders_service_1.MallOrdersService])
], MallOrdersController);
//# sourceMappingURL=mall-orders.controller.js.map