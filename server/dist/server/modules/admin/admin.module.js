"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const products_module_1 = require("@server/modules/products/products.module");
const upgrade_module_1 = require("@server/modules/upgrade/upgrade.module");
const admin_controller_1 = require("./admin.controller");
const finance_controller_1 = require("./finance.controller");
const admin_service_1 = require("./admin.service");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [products_module_1.ProductsModule, upgrade_module_1.UpgradeModule],
        controllers: [admin_controller_1.AdminController, finance_controller_1.FinanceController],
        providers: [admin_service_1.AdminService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map