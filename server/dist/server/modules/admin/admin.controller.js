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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("@server/common/guards/auth.guard");
const admin_service_1 = require("./admin.service");
const ADMIN_PHONES = ['13800000000'];
function checkAdmin(req) {
    const phone = req.user?.phone;
    if (!phone || !ADMIN_PHONES.includes(phone)) {
        throw new common_1.ForbiddenException('无管理员权限');
    }
}
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    async getProductList(page, pageSize, category, keyword, status) {
        return this.adminService.getProductList({
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
            category,
            keyword,
            status,
        });
    }
    async createProduct(req, body) {
        checkAdmin(req);
        return this.adminService.createProduct(body);
    }
    async updateProduct(req, id, body) {
        checkAdmin(req);
        return this.adminService.updateProduct(id, body);
    }
    async toggleProductStatus(req, id) {
        checkAdmin(req);
        return this.adminService.toggleProductStatus(id);
    }
    async getMallOrderList(page, pageSize, status) {
        return this.adminService.getMallOrderList({
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
            status,
        });
    }
    async reviewMallOrderPayment(id, dto) {
        return this.adminService.reviewMallOrderPayment(id, dto);
    }
    async shipMallOrder(id, dto) {
        return this.adminService.shipMallOrder(id, dto);
    }
    async cancelMallOrder(id) {
        return this.adminService.cancelMallOrder(id);
    }
    async getUserList(page, pageSize, level, keyword) {
        return this.adminService.getUserList({
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
            level,
            keyword,
        });
    }
    async getUserDetail(id) {
        return this.adminService.getUserDetail(id);
    }
    async getCompanyAuditList(page, pageSize) {
        return this.adminService.getCompanyAuditList({
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
        });
    }
    async reviewCompanyAudit(id, dto) {
        return this.adminService.reviewCompanyAudit(id, dto);
    }
    async getPlatformQrcode(type) {
        return this.adminService.getPlatformQrcode(type);
    }
    async updatePlatformQrcode(type, body) {
        return this.adminService.updatePlatformQrcode(type, body);
    }
    async getConsultOrderList(page, pageSize, status) {
        return this.adminService.getConsultOrderList({
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
            status,
        });
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('products'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('category')),
    __param(3, (0, common_1.Query)('keyword')),
    __param(4, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getProductList", null);
__decorate([
    (0, common_1.Post)('products'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Post)('products/:id/toggle-status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "toggleProductStatus", null);
__decorate([
    (0, common_1.Get)('mall-orders'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getMallOrderList", null);
__decorate([
    (0, common_1.Post)('mall-orders/:id/review-payment'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "reviewMallOrderPayment", null);
__decorate([
    (0, common_1.Post)('mall-orders/:id/ship'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "shipMallOrder", null);
__decorate([
    (0, common_1.Post)('mall-orders/:id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "cancelMallOrder", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('level')),
    __param(3, (0, common_1.Query)('keyword')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUserList", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUserDetail", null);
__decorate([
    (0, common_1.Get)('company-audits'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getCompanyAuditList", null);
__decorate([
    (0, common_1.Post)('company-audits/:id/review'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "reviewCompanyAudit", null);
__decorate([
    (0, common_1.Get)('qrcodes/:type'),
    __param(0, (0, common_1.Param)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPlatformQrcode", null);
__decorate([
    (0, common_1.Patch)('qrcodes/:type'),
    __param(0, (0, common_1.Param)('type')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updatePlatformQrcode", null);
__decorate([
    (0, common_1.Get)('consult-orders'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getConsultOrderList", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('api/admin'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map