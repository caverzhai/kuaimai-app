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
var TeamService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const api_interface_1 = require("@shared/api.interface");
const schema_1 = require("@server/database/schema");
const auth_util_1 = require("@server/common/utils/auth.util");
let TeamService = TeamService_1 = class TeamService {
    db;
    logger = new common_1.Logger(TeamService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getTeamTree(userId, isInvited) {
        const currentUsers = await this.db
            .select({
            id: schema_1.users.id,
            nickname: schema_1.users.nickname,
            avatarUrl: schema_1.users.avatarUrl,
            level: schema_1.users.level,
            directInviteCount: schema_1.users.directInviteCount,
            teamTotalCount: schema_1.users.teamTotalCount,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .limit(1);
        if (currentUsers.length === 0) {
            throw new common_1.ForbiddenException('用户不存在');
        }
        const currentUser = currentUsers[0];
        const pathPattern = `%,${userId},%`;
        const descendantRelations = await this.db
            .select({
            userId: schema_1.teamRelations.userId,
            parentId: schema_1.teamRelations.parentId,
            treeLevel: schema_1.teamRelations.treeLevel,
        })
            .from(schema_1.teamRelations)
            .where((0, drizzle_orm_1.like)(schema_1.teamRelations.path, pathPattern));
        if (descendantRelations.length === 0) {
            return {
                tree: {
                    userId: currentUser.id,
                    nickname: currentUser.nickname,
                    avatarUrl: currentUser.avatarUrl ?? undefined,
                    level: currentUser.level,
                    children: [],
                },
                directInviteCount: currentUser.directInviteCount,
                teamTotalCount: currentUser.teamTotalCount,
            };
        }
        const descendantUserIds = descendantRelations.map((r) => r.userId);
        const descendantUsers = await this.db
            .select({
            id: schema_1.users.id,
            nickname: schema_1.users.nickname,
            avatarUrl: schema_1.users.avatarUrl,
            level: schema_1.users.level,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.inArray)(schema_1.users.id, descendantUserIds));
        const userInfoMap = new Map();
        for (const u of descendantUsers) {
            userInfoMap.set(u.id, u);
        }
        const childrenByParent = new Map();
        for (const r of descendantRelations) {
            const parentId = r.parentId;
            if (!parentId)
                continue;
            const existing = childrenByParent.get(parentId) ?? [];
            existing.push(r.userId);
            childrenByParent.set(parentId, existing);
        }
        const buildTree = (nodeUserId) => {
            const info = userInfoMap.get(nodeUserId);
            const childIds = childrenByParent.get(nodeUserId) ?? [];
            const children = childIds.map((cid) => buildTree(cid));
            if (nodeUserId === currentUser.id) {
                return {
                    userId: currentUser.id,
                    nickname: currentUser.nickname,
                    avatarUrl: currentUser.avatarUrl ?? undefined,
                    level: currentUser.level,
                    children,
                };
            }
            return {
                userId: nodeUserId,
                nickname: info?.nickname ?? '未知用户',
                avatarUrl: info?.avatarUrl ?? undefined,
                level: info?.level ?? 'junior',
                children,
            };
        };
        const tree = buildTree(currentUser.id);
        return {
            tree,
            directInviteCount: currentUser.directInviteCount,
            teamTotalCount: currentUser.teamTotalCount,
        };
    }
    async getInviteInfo(userId, userLevel) {
        const layer = api_interface_1.LEVEL_LAYERS[userLevel] ?? 0;
        if (layer < 4) {
            throw new common_1.BadRequestException('仅4级及以上咨询师拥有邀请码，请先升级');
        }
        const currentUsers = await this.db
            .select({
            id: schema_1.users.id,
            inviteCode: schema_1.users.inviteCode,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .limit(1);
        if (currentUsers.length === 0) {
            throw new common_1.BadRequestException('用户不存在');
        }
        let inviteCode = currentUsers[0].inviteCode;
        if (!inviteCode) {
            inviteCode = await this.generateAndSaveInviteCode(userId);
        }
        const records = await this.db
            .select({
            id: schema_1.inviteRecords.id,
            inviterId: schema_1.inviteRecords.inviterId,
            inviteeId: schema_1.inviteRecords.inviteeId,
            inviteCode: schema_1.inviteRecords.inviteCode,
            registeredAt: schema_1.inviteRecords.registeredAt,
        })
            .from(schema_1.inviteRecords)
            .where((0, drizzle_orm_1.eq)(schema_1.inviteRecords.inviterId, userId))
            .orderBy((0, drizzle_orm_1.sql) `${schema_1.inviteRecords.registeredAt} DESC`);
        let inviteeList = [];
        if (records.length > 0) {
            const inviteeIds = records.map((r) => r.inviteeId);
            inviteeList = await this.db
                .select({
                id: schema_1.users.id,
                nickname: schema_1.users.nickname,
                avatarUrl: schema_1.users.avatarUrl,
                phone: schema_1.users.phone,
                level: schema_1.users.level,
            })
                .from(schema_1.users)
                .where((0, drizzle_orm_1.inArray)(schema_1.users.id, inviteeIds));
        }
        const inviteeMap = new Map();
        for (const u of inviteeList) {
            inviteeMap.set(u.id, u);
        }
        const recordList = records.map((r) => {
            const invitee = inviteeMap.get(r.inviteeId);
            return {
                id: r.id,
                inviterId: r.inviterId,
                inviteeId: r.inviteeId,
                invitee: invitee
                    ? {
                        nickname: invitee.nickname,
                        avatarUrl: invitee.avatarUrl ?? undefined,
                        phone: invitee.phone,
                        level: invitee.level,
                    }
                    : undefined,
                inviteCode: r.inviteCode,
                registeredAt: r.registeredAt.toISOString(),
            };
        });
        return {
            inviteCode,
            records: recordList,
            total: records.length,
        };
    }
    async generateAndSaveInviteCode(userId) {
        let code = (0, auth_util_1.generateInviteCode)(6);
        let attempts = 0;
        while (attempts < 5) {
            try {
                const updated = await this.db
                    .update(schema_1.users)
                    .set({ inviteCode: code })
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                    .returning({ inviteCode: schema_1.users.inviteCode });
                if (updated.length > 0 && updated[0].inviteCode) {
                    return updated[0].inviteCode;
                }
                break;
            }
            catch {
                code = (0, auth_util_1.generateInviteCode)(6);
                attempts += 1;
            }
        }
        throw new common_1.ConflictException('生成邀请码失败，请稍后重试');
    }
};
exports.TeamService = TeamService;
exports.TeamService = TeamService = TeamService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], TeamService);
//# sourceMappingURL=team.service.js.map