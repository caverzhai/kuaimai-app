"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradeModule = void 0;
const common_1 = require("@nestjs/common");
const upgrade_service_1 = require("./upgrade.service");
const upgrade_controller_1 = require("./upgrade.controller");
let UpgradeModule = class UpgradeModule {
};
exports.UpgradeModule = UpgradeModule;
exports.UpgradeModule = UpgradeModule = __decorate([
    (0, common_1.Module)({
        controllers: [upgrade_controller_1.UpgradeController],
        providers: [upgrade_service_1.UpgradeService],
        exports: [upgrade_service_1.UpgradeService],
    })
], UpgradeModule);
//# sourceMappingURL=upgrade.module.js.map