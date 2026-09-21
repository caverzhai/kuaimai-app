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
exports.SellersController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/guards/auth.guard");
const sellers_service_1 = require("./sellers.service");
let SellersController = class SellersController {
    sellersService;
    constructor(sellersService) {
        this.sellersService = sellersService;
    }
    sellerId(req) {
        return req.user.userId;
    }
    async getProducts(req, page = '1', pageSize = '20', status) {
        return this.sellersService.getSellerProducts(this.sellerId(req), parseInt(page, 10), parseInt(pageSize, 10), status);
    }
    async createProduct(req, body) {
        return { success: false, message: '卖家身份仅用于收款，不能上传商品，请联系管理员上架商品' };
    }
    async updateProduct(req, id, body) {
        return { success: false, message: '卖家身份仅用于收款，不能编辑商品，请联系管理员' };
    }
    async toggleProductStatus(req, id) {
        return { success: false, message: '卖家身份仅用于收款，不能上下架商品，请联系管理员' };
    }
    async getOrders(req, page = '1', pageSize = '20', status) {
        return this.sellersService.getSellerOrders(this.sellerId(req), parseInt(page, 10), parseInt(pageSize, 10), status);
    }
    async shipOrder(req, id, dto) {
        return this.sellersService.sellerShipOrder(this.sellerId(req), id, dto);
    }
    async getManagementFees(req, page = '1', pageSize = '20', status) {
        return this.sellersService.getSellerManagementFees(this.sellerId(req), parseInt(page, 10), parseInt(pageSize, 10), status);
    }
    async payManagementFee(req, id, body) {
        return this.sellersService.payManagementFee(this.sellerId(req), id, body.screenshotUrl);
    }
    async getStats(req) {
        return this.sellersService.getSellerStats(this.sellerId(req));
    }
    async apply(req, dto) {
        return this.sellersService.applySeller(this.sellerId(req), dto);
    }
};
exports.SellersController = SellersController;
__decorate([
    (0, common_1.Get)('products'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Post)('products'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Post)('products/:id/toggle-status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "toggleProductStatus", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Post)('orders/:id/ship'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "shipOrder", null);
__decorate([
    (0, common_1.Get)('management-fees'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "getManagementFees", null);
__decorate([
    (0, common_1.Post)('management-fees/:id/pay'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "payManagementFee", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "getStats", null);
__decorate([
    (0, common_1.Post)('apply'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SellersController.prototype, "apply", null);
exports.SellersController = SellersController = __decorate([
    (0, common_1.Controller)('api/seller'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [sellers_service_1.SellersService])
], SellersController);
//# sourceMappingURL=sellers.controller.js.map