"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultOrdersModule = void 0;
const common_1 = require("@nestjs/common");
const consult_orders_controller_1 = require("./consult-orders.controller");
const consult_orders_service_1 = require("./consult-orders.service");
const upgrade_module_1 = require("../upgrade/upgrade.module");
let ConsultOrdersModule = class ConsultOrdersModule {
};
exports.ConsultOrdersModule = ConsultOrdersModule;
exports.ConsultOrdersModule = ConsultOrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [upgrade_module_1.UpgradeModule],
        controllers: [consult_orders_controller_1.ConsultOrdersController],
        providers: [consult_orders_service_1.ConsultOrdersService],
    })
], ConsultOrdersModule);
//# sourceMappingURL=consult-orders.module.js.map