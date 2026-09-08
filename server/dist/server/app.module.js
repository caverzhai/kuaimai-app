"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const database_module_1 = require("./database/database.module");
const exception_filter_1 = require("./common/filters/exception.filter");
const users_module_1 = require("./modules/users/users.module");
const products_module_1 = require("./modules/products/products.module");
const mall_orders_module_1 = require("./modules/mall-orders/mall-orders.module");
const consult_orders_module_1 = require("./modules/consult-orders/consult-orders.module");
const consultants_module_1 = require("./modules/consultants/consultants.module");
const upgrade_module_1 = require("./modules/upgrade/upgrade.module");
const team_module_1 = require("./modules/team/team.module");
const admin_module_1 = require("./modules/admin/admin.module");
const upload_module_1 = require("./modules/upload/upload.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            users_module_1.UsersModule,
            products_module_1.ProductsModule,
            mall_orders_module_1.MallOrdersModule,
            consult_orders_module_1.ConsultOrdersModule,
            consultants_module_1.ConsultantsModule,
            upgrade_module_1.UpgradeModule,
            team_module_1.TeamModule,
            admin_module_1.AdminModule,
            upload_module_1.UploadModule,
        ],
        providers: [
            {
                provide: core_1.APP_FILTER,
                useClass: exception_filter_1.GlobalExceptionFilter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map