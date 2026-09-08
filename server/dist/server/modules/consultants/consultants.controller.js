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
exports.ConsultantsController = void 0;
const common_1 = require("@nestjs/common");
const consultants_service_1 = require("./consultants.service");
const auth_guard_1 = require("@server/common/guards/auth.guard");
let ConsultantsController = class ConsultantsController {
    consultantsService;
    constructor(consultantsService) {
        this.consultantsService = consultantsService;
    }
    async getIndustries() {
        return this.consultantsService.getIndustries();
    }
    async getConsultantList(req, query) {
        return this.consultantsService.getConsultantList(query);
    }
    async getConsultantDetail(req, id) {
        return this.consultantsService.getConsultantDetail(id);
    }
};
exports.ConsultantsController = ConsultantsController;
__decorate([
    (0, common_1.Get)('industries'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsultantsController.prototype, "getIndustries", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConsultantsController.prototype, "getConsultantList", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConsultantsController.prototype, "getConsultantDetail", null);
exports.ConsultantsController = ConsultantsController = __decorate([
    (0, common_1.Controller)('api/consultants'),
    __metadata("design:paramtypes", [consultants_service_1.ConsultantsService])
], ConsultantsController);
//# sourceMappingURL=consultants.controller.js.map