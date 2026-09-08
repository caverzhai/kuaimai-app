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
var ConsultantsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultantsService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
const api_interface_1 = require("@shared/api.interface");
let ConsultantsService = ConsultantsService_1 = class ConsultantsService {
    db;
    logger = new common_1.Logger(ConsultantsService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getConsultantList(query) {
        const page = query.page && query.page > 0 ? query.page : 1;
        const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
        const offset = (page - 1) * pageSize;
        const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
        const conditions = [(0, drizzle_orm_1.or)((0, drizzle_orm_1.ne)(schema_1.users.level, api_interface_1.LEVELS.JUNIOR), (0, drizzle_orm_1.eq)(schema_1.users.id, ADMIN_ID))];
        if (query.industry) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.users.industry, query.industry));
        }
        if (query.level) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.users.level, query.level));
        }
        if (query.keyword) {
            conditions.push((0, drizzle_orm_1.ilike)(schema_1.users.nickname, `%${query.keyword}%`));
        }
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const levelOrderSql = (0, drizzle_orm_1.sql) `CASE ${schema_1.users.level}
      WHEN ${api_interface_1.LEVELS.LEVEL_8} THEN 8
      WHEN ${api_interface_1.LEVELS.LEVEL_7} THEN 7
      WHEN ${api_interface_1.LEVELS.LEVEL_6} THEN 6
      WHEN ${api_interface_1.LEVELS.LEVEL_5} THEN 5
      WHEN ${api_interface_1.LEVELS.LEVEL_4} THEN 4
      ELSE 0
    END DESC`;
        const [countResult, itemsResult] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.users)
                .where(whereClause),
            this.db
                .select({
                id: schema_1.users.id,
                nickname: schema_1.users.nickname,
                avatarUrl: schema_1.users.avatarUrl,
                level: schema_1.users.level,
                industry: schema_1.users.industry,
                qualification: schema_1.users.qualification,
                serviceStandard: schema_1.users.serviceStandard,
                directInviteCount: schema_1.users.directInviteCount,
            })
                .from(schema_1.users)
                .where(whereClause)
                .orderBy(levelOrderSql, (0, drizzle_orm_1.desc)(schema_1.users.createdAt))
                .limit(pageSize)
                .offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        const items = itemsResult.map((row) => ({
            id: row.id,
            nickname: row.nickname,
            avatarUrl: row.avatarUrl ?? undefined,
            level: row.level,
            industry: row.industry ?? undefined,
            qualification: row.qualification ?? undefined,
            serviceStandard: row.serviceStandard ?? undefined,
            directInviteCount: row.directInviteCount,
        }));
        return {
            items,
            total,
            page,
            pageSize,
        };
    }
    async getConsultantDetail(id) {
        const result = await this.db
            .select({
            id: schema_1.users.id,
            nickname: schema_1.users.nickname,
            avatarUrl: schema_1.users.avatarUrl,
            level: schema_1.users.level,
            industry: schema_1.users.industry,
            qualification: schema_1.users.qualification,
            serviceStandard: schema_1.users.serviceStandard,
            wechatQrcodeUrl: schema_1.users.wechatQrcodeUrl,
            alipayQrcodeUrl: schema_1.users.alipayQrcodeUrl,
            companyQrcodeUrl: schema_1.users.companyQrcodeUrl,
            companyAuditStatus: schema_1.users.companyAuditStatus,
            directInviteCount: schema_1.users.directInviteCount,
            createdAt: schema_1.users.createdAt,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
            .limit(1);
        if (result.length === 0) {
            throw new common_1.NotFoundException('咨询师不存在');
        }
        const row = result[0];
        const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
        if (row.level === api_interface_1.LEVELS.JUNIOR && row.id !== ADMIN_ID) {
            throw new common_1.NotFoundException('咨询师不存在');
        }
        const isLevel7OrAbove = row.level === api_interface_1.LEVELS.LEVEL_7 || row.level === api_interface_1.LEVELS.LEVEL_8;
        const hasCompanyApproval = row.companyAuditStatus === 'approved';
        return {
            id: row.id,
            nickname: row.nickname,
            avatarUrl: row.avatarUrl ?? undefined,
            level: row.level,
            industry: row.industry ?? undefined,
            qualification: row.qualification ?? undefined,
            serviceStandard: row.serviceStandard ?? undefined,
            directInviteCount: row.directInviteCount,
            wechatQrcodeUrl: !isLevel7OrAbove ? row.wechatQrcodeUrl ?? undefined : undefined,
            alipayQrcodeUrl: !isLevel7OrAbove ? row.alipayQrcodeUrl ?? undefined : undefined,
            companyQrcodeUrl: isLevel7OrAbove && hasCompanyApproval
                ? row.companyQrcodeUrl ?? undefined
                : undefined,
            companyAuditStatus: row.companyAuditStatus ?? undefined,
            createdAt: row.createdAt.toISOString(),
        };
    }
    async getIndustries() {
        const result = await this.db
            .select({
            id: schema_1.industries.id,
            name: schema_1.industries.name,
            sortOrder: schema_1.industries.sortOrder,
        })
            .from(schema_1.industries)
            .orderBy((0, drizzle_orm_1.asc)(schema_1.industries.sortOrder));
        return result.map((row) => ({
            id: row.id,
            name: row.name,
            sortOrder: row.sortOrder,
        }));
    }
};
exports.ConsultantsService = ConsultantsService;
exports.ConsultantsService = ConsultantsService = ConsultantsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], ConsultantsService);
//# sourceMappingURL=consultants.service.js.map