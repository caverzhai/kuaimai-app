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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const drizzle_orm_1 = require("drizzle-orm");
const api_interface_1 = require("@shared/api.interface");
const schema_1 = require("@server/database/schema");
const auth_util_1 = require("@server/common/utils/auth.util");
const common_2 = require("@nestjs/common");
const MAX_DIRECT_CHILDREN = 3;
let UsersService = UsersService_1 = class UsersService {
    db;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(db) {
        this.db = db;
    }
    async register(dto) {
        if (!/^1\d{10}$/.test(dto.phone)) {
            throw new common_2.BadRequestException('手机号格式不正确，必须是11位数字');
        }
        const existing = await this.db
            .select({ id: schema_1.users.id })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.phone, dto.phone))
            .limit(1);
        if (existing.length > 0) {
            throw new common_2.ConflictException('手机号已注册');
        }
        const existingNickname = await this.db
            .select({ id: schema_1.users.id })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.nickname, dto.nickname))
            .limit(1);
        if (existingNickname.length > 0) {
            throw new common_2.ConflictException('昵称已被使用，请换一个昵称');
        }
        let inviter = null;
        if (dto.inviteCode) {
            const inviterRows = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.inviteCode, dto.inviteCode))
                .limit(1);
            if (inviterRows.length === 0) {
                throw new common_2.BadRequestException('邀请码无效');
            }
            inviter = inviterRows[0];
        }
        const hashedPassword = (0, auth_util_1.hashPassword)(dto.password);
        const inviteCode = (0, auth_util_1.generateInviteCode)(8);
        const result = await this.db.transaction(async (tx) => {
            const [newUser] = await tx
                .insert(schema_1.users)
                .values({
                phone: dto.phone,
                nickname: dto.nickname,
                password: hashedPassword,
                avatarUrl: dto.avatarUrl,
                level: api_interface_1.LEVELS.JUNIOR,
                isInvited: !!inviter,
                inviterId: inviter?.id,
                inviteCode,
            })
                .returning();
            if (inviter) {
                const { parentId, parentRelation } = await this.findParentForSliding(tx, inviter.id);
                const treeLevel = parentRelation ? parentRelation.treeLevel + 1 : 1;
                const basePath = parentRelation?.path ?? `,${inviter.id},`;
                const path = `${basePath}${newUser.id},`;
                const childCount = await tx
                    .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
                    .from(schema_1.teamRelations)
                    .where((0, drizzle_orm_1.eq)(schema_1.teamRelations.parentId, parentId));
                const position = Number(childCount[0]?.count ?? 0);
                await tx.insert(schema_1.teamRelations).values({
                    userId: newUser.id,
                    parentId,
                    inviterId: inviter.id,
                    treeLevel,
                    path,
                    position,
                });
                await tx
                    .update(schema_1.users)
                    .set({ parentId, treeLevel })
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, newUser.id));
                await tx
                    .update(schema_1.users)
                    .set({
                    directInviteCount: (0, drizzle_orm_1.sql) `${schema_1.users.directInviteCount} + 1`,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, inviter.id));
                const ancestorIds = path
                    .split(',')
                    .filter((s) => s.length > 0 && s !== newUser.id);
                if (ancestorIds.length > 0) {
                    await tx
                        .update(schema_1.users)
                        .set({
                        teamTotalCount: (0, drizzle_orm_1.sql) `${schema_1.users.teamTotalCount} + 1`,
                    })
                        .where((0, drizzle_orm_1.sql) `${schema_1.users.id} = ANY(ARRAY[${drizzle_orm_1.sql.join(ancestorIds.map((id) => (0, drizzle_orm_1.sql) `${id}::uuid`), (0, drizzle_orm_1.sql) `, `)}]::uuid[])`);
                }
                await tx.insert(schema_1.inviteRecords).values({
                    inviterId: inviter.id,
                    inviteeId: newUser.id,
                    inviteCode: dto.inviteCode,
                });
                const [updatedUser] = await tx
                    .select()
                    .from(schema_1.users)
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, newUser.id))
                    .limit(1);
                return updatedUser;
            }
            return newUser;
        });
        const token = this.makeToken(result);
        return { token, user: this.toUserInfo(result) };
    }
    async login(dto) {
        const userRows = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.phone, dto.phone))
            .limit(1);
        if (userRows.length === 0) {
            throw new common_2.UnauthorizedException('手机号或密码错误');
        }
        const user = userRows[0];
        if (!(0, auth_util_1.verifyPassword)(dto.password, user.password)) {
            throw new common_2.UnauthorizedException('手机号或密码错误');
        }
        const token = this.makeToken(user);
        return { token, user: this.toUserInfo(user) };
    }
    async getCurrentUser(userId) {
        const userRows = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .limit(1);
        if (userRows.length === 0) {
            throw new common_2.NotFoundException('用户不存在');
        }
        return this.toUserInfo(userRows[0]);
    }
    async updateProfile(userId, dto) {
        const patch = {};
        if (dto.nickname !== undefined)
            patch.nickname = dto.nickname;
        if (dto.avatarUrl !== undefined)
            patch.avatarUrl = dto.avatarUrl;
        if (dto.gender !== undefined)
            patch.gender = dto.gender;
        if (dto.age !== undefined)
            patch.age = dto.age;
        if (dto.receiveAddress !== undefined)
            patch.receiveAddress = dto.receiveAddress;
        if (dto.receivePhone !== undefined)
            patch.receivePhone = dto.receivePhone;
        if (dto.industry !== undefined)
            patch.industry = dto.industry;
        if (dto.qualification !== undefined)
            patch.qualification = dto.qualification;
        if (dto.serviceStandard !== undefined)
            patch.serviceStandard = dto.serviceStandard;
        if (dto.wechatQrcodeUrl !== undefined)
            patch.wechatQrcodeUrl = dto.wechatQrcodeUrl;
        if (dto.alipayQrcodeUrl !== undefined)
            patch.alipayQrcodeUrl = dto.alipayQrcodeUrl;
        if (dto.companyQrcodeUrl !== undefined)
            patch.companyQrcodeUrl = dto.companyQrcodeUrl;
        if (dto.businessLicenseUrl !== undefined)
            patch.businessLicenseUrl = dto.businessLicenseUrl;
        if (Object.keys(patch).length === 0) {
            throw new common_2.BadRequestException('未提供可更新字段');
        }
        if (dto.companyQrcodeUrl !== undefined || dto.businessLicenseUrl !== undefined) {
            patch.companyAuditStatus = 'pending';
        }
        const updated = await this.db
            .update(schema_1.users)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        if (updated.length === 0) {
            throw new common_2.NotFoundException('用户不存在');
        }
        return this.toUserInfo(updated[0]);
    }
    async supplementInviter(userId, dto) {
        const userRows = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .limit(1);
        if (userRows.length === 0) {
            throw new common_2.NotFoundException('用户不存在');
        }
        const user = userRows[0];
        if (user.isInvited) {
            throw new common_2.BadRequestException('您已经有邀请人，无需补充');
        }
        const inviterRows = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.inviteCode, dto.inviteCode))
            .limit(1);
        if (inviterRows.length === 0) {
            throw new common_2.BadRequestException('邀请码无效');
        }
        const inviter = inviterRows[0];
        if (inviter.id === userId) {
            throw new common_2.BadRequestException('不能使用自己的邀请码');
        }
        const result = await this.db.transaction(async (tx) => {
            const { parentId, parentRelation } = await this.findParentForSliding(tx, inviter.id);
            const treeLevel = parentRelation ? parentRelation.treeLevel + 1 : 1;
            const basePath = parentRelation?.path ?? `,${inviter.id},`;
            const path = `${basePath}${user.id},`;
            const childCount = await tx
                .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
                .from(schema_1.teamRelations)
                .where((0, drizzle_orm_1.eq)(schema_1.teamRelations.parentId, parentId));
            const position = Number(childCount[0]?.count ?? 0);
            await tx.insert(schema_1.teamRelations).values({
                userId: user.id,
                parentId,
                inviterId: inviter.id,
                treeLevel,
                path,
                position,
            });
            await tx
                .update(schema_1.users)
                .set({
                isInvited: true,
                inviterId: inviter.id,
                parentId,
                treeLevel,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id));
            await tx
                .update(schema_1.users)
                .set({
                directInviteCount: (0, drizzle_orm_1.sql) `${schema_1.users.directInviteCount} + 1`,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, inviter.id));
            const ancestorIds = path
                .split(',')
                .filter((s) => s.length > 0 && s !== user.id);
            if (ancestorIds.length > 0) {
                await tx
                    .update(schema_1.users)
                    .set({
                    teamTotalCount: (0, drizzle_orm_1.sql) `${schema_1.users.teamTotalCount} + 1`,
                })
                    .where((0, drizzle_orm_1.sql) `${schema_1.users.id} = ANY(ARRAY[${drizzle_orm_1.sql.join(ancestorIds.map((id) => (0, drizzle_orm_1.sql) `${id}::uuid`), (0, drizzle_orm_1.sql) `, `)}]::uuid[])`);
            }
            await tx.insert(schema_1.inviteRecords).values({
                inviterId: inviter.id,
                inviteeId: user.id,
                inviteCode: dto.inviteCode,
            });
            const [updatedUser] = await tx
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id))
                .limit(1);
            return updatedUser;
        });
        return this.toUserInfo(result);
    }
    async getOrGenerateInviteCode(userId) {
        const userRows = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .limit(1);
        if (userRows.length === 0) {
            throw new common_2.NotFoundException('用户不存在');
        }
        const user = userRows[0];
        const levelLayer = this.getLevelLayer(user.level);
        const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
        if (levelLayer < 4 && user.id !== ADMIN_ID) {
            throw new common_2.BadRequestException('仅4级及以上咨询师可生成邀请码');
        }
        if (user.inviteCode) {
            return { inviteCode: user.inviteCode };
        }
        let inviteCode = (0, auth_util_1.generateInviteCode)();
        let attempts = 0;
        while (attempts < 5) {
            try {
                const updated = await this.db
                    .update(schema_1.users)
                    .set({ inviteCode })
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                    .returning({ inviteCode: schema_1.users.inviteCode });
                if (updated.length > 0 && updated[0].inviteCode) {
                    return { inviteCode: updated[0].inviteCode };
                }
                break;
            }
            catch {
                inviteCode = (0, auth_util_1.generateInviteCode)();
                attempts += 1;
            }
        }
        throw new common_2.ConflictException('生成邀请码失败，请稍后重试');
    }
    async findParentForSliding(tx, inviterId) {
        const queue = [inviterId];
        const visited = new Set();
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId))
                continue;
            visited.add(currentId);
            const children = await tx
                .select()
                .from(schema_1.teamRelations)
                .where((0, drizzle_orm_1.eq)(schema_1.teamRelations.parentId, currentId));
            if (children.length < MAX_DIRECT_CHILDREN) {
                const relationRows = await tx
                    .select()
                    .from(schema_1.teamRelations)
                    .where((0, drizzle_orm_1.eq)(schema_1.teamRelations.userId, currentId))
                    .limit(1);
                return {
                    parentId: currentId,
                    parentRelation: relationRows[0] ?? null,
                };
            }
            const sortedChildren = [...children].sort((a, b) => a.position - b.position);
            for (const child of sortedChildren) {
                queue.push(child.userId);
            }
        }
        this.logger.warn(`BFS sliding fallback to inviter: ${inviterId}`);
        return { parentId: inviterId, parentRelation: null };
    }
    makeToken(user) {
        return (0, auth_util_1.generateToken)({
            userId: user.id,
            phone: user.phone,
            level: user.level,
            isInvited: user.isInvited,
        });
    }
    getLevelLayer(level) {
        const layerMap = {
            [api_interface_1.LEVELS.JUNIOR]: 0,
            [api_interface_1.LEVELS.LEVEL_4]: 4,
            [api_interface_1.LEVELS.LEVEL_5]: 5,
            [api_interface_1.LEVELS.LEVEL_6]: 6,
            [api_interface_1.LEVELS.LEVEL_7]: 7,
            [api_interface_1.LEVELS.LEVEL_8]: 8,
        };
        return layerMap[level] ?? 0;
    }
    toUserInfo(user) {
        return {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl ?? undefined,
            gender: user.gender ?? undefined,
            age: user.age ?? undefined,
            level: user.level,
            isInvited: user.isInvited,
            inviterId: user.inviterId ?? undefined,
            parentId: user.parentId ?? undefined,
            inviteCode: user.inviteCode ?? undefined,
            receiveAddress: user.receiveAddress ?? undefined,
            receivePhone: user.receivePhone ?? undefined,
            industry: user.industry ?? undefined,
            qualification: user.qualification ?? undefined,
            serviceStandard: user.serviceStandard ?? undefined,
            wechatQrcodeUrl: user.wechatQrcodeUrl ?? undefined,
            alipayQrcodeUrl: user.alipayQrcodeUrl ?? undefined,
            companyQrcodeUrl: user.companyQrcodeUrl ?? undefined,
            businessLicenseUrl: user.businessLicenseUrl ?? undefined,
            companyAuditStatus: user.companyAuditStatus ?? undefined,
            totalConsultIncome: String(user.totalConsultIncome),
            thresholdBlocked: user.thresholdBlocked,
            thresholdTriggeredAt: user.thresholdTriggeredAt
                ? user.thresholdTriggeredAt.toISOString()
                : undefined,
            pendingReclaimAmount: String(user.pendingReclaimAmount),
            overflowLossAmount: String(user.overflowLossAmount),
            directInviteCount: user.directInviteCount,
            teamTotalCount: user.teamTotalCount,
            treeLevel: user.treeLevel,
            createdAt: user.createdAt.toISOString(),
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], UsersService);
//# sourceMappingURL=users.service.js.map