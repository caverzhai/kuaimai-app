import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '@server/common/guards/auth.guard';
import { AdminGuard } from '@server/common/guards/admin.guard';
import { UpgradeService } from '@server/modules/upgrade/upgrade.service';
import { AdminService } from './admin.service';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  upgradeTasks, users, mallOrders, consultOrders, teamRelations, inviteRecords,
  products, chatRooms, chatRoomMembers, chatRoomApplications, chatMessages,
  chatMicSlots, friends, managementFees, platformCollectionRecords,
  cloneNotifications, systemNotifications,
} from '@server/database/schema';
import { inArray, sql, eq, and, or, notInArray } from 'drizzle-orm';
import { isValidNickname } from '@shared/validation';
import { verifyPassword } from '@server/common/utils/auth.util';

// 管理员手机号列表
const ADMIN_PHONES = ['13800000000'];

// 管理员权限判断装饰器
function checkAdmin(req: Request) {
  const phone = req.user?.phone;
  if (!phone || !ADMIN_PHONES.includes(phone)) {
    throw new ForbiddenException('无管理员权限');
  }
}
import type {
  ProductListResponse,
  ProductInfo,
  MallOrderListResponse,
  MallOrderInfo,
  ConsultOrderListResponse,
  UserInfo,
  PlatformQrcodeInfo,
  ReviewDTO,
  ShipDTO,
} from '@shared/api.interface';

interface CreateProductBody {
  name: string;
  price: string;
  description?: string;
  category?: string;
  spec?: string;
  mainImages: { url: string }[];
  detailImages: { url: string }[];
  sortOrder?: number;
}

interface UpdateProductBody {
  name?: string;
  price?: string;
  description?: string;
  category?: string;
  spec?: string;
  mainImages?: { url: string }[];
  detailImages?: { url: string }[];
  status?: string;
  sortOrder?: number;
}

interface QrcodeUpdateBody {
  wechatQrcodeUrl?: string;
  alipayQrcodeUrl?: string;
}

@Controller('api/admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly upgradeService: UpgradeService,
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ============================================================
  // 任务扶正
  // ============================================================

  @Post('reconcile-admin-targets')
  async reconcileAdminTargets() {
    return this.upgradeService.reconcileAdminTargets();
  }

  // ============================================================
  // 商品管理
  // ============================================================

  @Get('products')
  async getProductList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ): Promise<ProductListResponse> {
    return this.adminService.getProductList({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      category,
      keyword,
      status,
    });
  }

  @Post('products')
  async createProduct(
    @Req() req: Request,
    @Body() body: CreateProductBody,
  ): Promise<ProductInfo> {
    checkAdmin(req);
    return this.adminService.createProduct(body);
  }

  @Patch('products/:id')
  async updateProduct(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateProductBody,
  ): Promise<ProductInfo> {
    checkAdmin(req);
    return this.adminService.updateProduct(id, body);
  }

  @Post('products/:id/toggle-status')
  async toggleProductStatus(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ProductInfo> {
    checkAdmin(req);
    return this.adminService.toggleProductStatus(id);
  }

  @Delete('products/:id')
  async deleteProduct(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    checkAdmin(req);
    return this.adminService.deleteProduct(id);
  }

  // ============================================================
  // 商城订单管理
  // ============================================================

  @Get('mall-orders')
  async getMallOrderList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ): Promise<MallOrderListResponse> {
    return this.adminService.getMallOrderList({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      status,
    });
  }

  @Post('mall-orders/:id/review-payment')
  async reviewMallOrderPayment(
    @Param('id') id: string,
    @Body() dto: ReviewDTO,
  ): Promise<MallOrderInfo> {
    return this.adminService.reviewMallOrderPayment(id, dto);
  }

  @Post('mall-orders/:id/ship')
  async shipMallOrder(
    @Param('id') id: string,
    @Body() dto: ShipDTO,
  ): Promise<MallOrderInfo> {
    return this.adminService.shipMallOrder(id, dto);
  }

  @Post('mall-orders/:id/cancel')
  async cancelMallOrder(@Param('id') id: string): Promise<MallOrderInfo> {
    return this.adminService.cancelMallOrder(id);
  }

  // ============================================================
  // 用户管理
  // ============================================================

  @Get('users')
  async getUserList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('level') level?: string,
    @Query('keyword') keyword?: string,
  ): Promise<{
    items: UserInfo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.adminService.getUserList({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      level,
      keyword,
    });
  }

  @Get('users/:id')
  async getUserDetail(@Param('id') id: string): Promise<UserInfo> {
    return this.adminService.getUserDetail(id);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { newPassword?: string },
  ): Promise<{ success: boolean }> {
    checkAdmin(req);
    return this.adminService.resetUserPassword(id, body.newPassword || '');
  }

  // ============================================================
  // 公司资质审核
  // ============================================================

  @Get('company-audits')
  async getCompanyAuditList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{
    items: UserInfo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.adminService.getCompanyAuditList({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('company-audits/:id/review')
  async reviewCompanyAudit(
    @Param('id') id: string,
    @Body() dto: ReviewDTO,
  ): Promise<UserInfo> {
    return this.adminService.reviewCompanyAudit(id, dto);
  }

  // ============================================================
  // 平台收款码管理
  // ============================================================

  @Get('qrcodes/:type')
  async getPlatformQrcode(@Param('type') type: string): Promise<PlatformQrcodeInfo> {
    return this.adminService.getPlatformQrcode(type);
  }

  @Patch('qrcodes/:type')
  async updatePlatformQrcode(
    @Param('type') type: string,
    @Body() body: QrcodeUpdateBody,
  ): Promise<PlatformQrcodeInfo> {
    return this.adminService.updatePlatformQrcode(type, body);
  }

  // ============================================================
  // 咨询订单管理
  // ============================================================

  @Get('consult-orders')
  async getConsultOrderList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ): Promise<ConsultOrderListResponse> {
    return this.adminService.getConsultOrderList({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      status,
    });
  }

  // 临时：补完成指定用户的商城购买任务
  @Post('fix-mall-task')
  async fixMallTask(@Req() req: Request, @Body() body: { userId: string }) {
    checkAdmin(req);
    const result = await this.adminService.fixUserMallTask(body.userId);
    return { success: true, result };
  }

  // 清理初级用户的团队树位置（新规则：初级用户不占团队树位置）
  @Post('clean-junior-team-positions')
  async cleanJuniorTeamPositions(@Req() req: Request) {
    checkAdmin(req);
    const result = await this.adminService.cleanJuniorTeamPositions();
    return { success: true, result };
  }

  // 手动修复：把用户以"待位"放进团队树、校正4级收款人、手动完成前 N 个任务
  @Post('fix-level4-placement')
  async fixLevel4Placement(
    @Req() req: Request,
    @Body() body: { userId: string; completeBeforeIndex?: number },
  ) {
    checkAdmin(req);
    const result = await this.adminService.fixUserLevel4Placement(
      body.userId,
      typeof body.completeBeforeIndex === 'number' ? body.completeBeforeIndex : 4,
    );
    return { success: true, result };
  }

  // 临时：删除所有未完成的升级任务（修复层级bug后重置）
  @Post('reset-upgrade-tasks')
  async resetUpgradeTasks(@Req() req: Request) {
    checkAdmin(req);
    const deleted = await this.db
      .delete(upgradeTasks)
      .where(inArray(upgradeTasks.status, ['pending', 'in_progress']))
      .returning({ id: upgradeTasks.id, userId: upgradeTasks.userId, taskIndex: upgradeTasks.taskIndex, title: upgradeTasks.title });
    return { success: true, deletedCount: deleted.length, deleted };
  }

  // 修改用户手机号
  @Patch('users/:id/phone')
  async updateUserPhone(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { phone: string },
  ): Promise<UserInfo> {
    checkAdmin(req);
    return this.adminService.updateUserPhone(id, body.phone);
  }

  // 批量删除用户（支持指定删除ID或保留手机号）—— 完整级联清除，所有端对齐
  @Post('users/batch-delete')
  async batchDeleteUsers(
    @Req() req: Request,
    @Body() body: { keepPhones?: string[]; deleteUserIds?: string[]; adminPassword?: string },
  ) {
    checkAdmin(req);

    // 必须校验当前登录管理员密码，防止误删/越权删除
    const adminRows = await this.db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, req.user.userId))
      .limit(1);
    const adminHash = adminRows[0]?.password ?? '';
    const plain = body.adminPassword || '';
    const passwordOk =
      (await verifyPassword(plain, adminHash)) ||
      (await verifyPassword(plain.trim(), adminHash));
    if (!passwordOk) {
      throw new ForbiddenException('管理员密码不正确，无法删除用户');
    }

    const keepPhones = body.keepPhones || [];
    const deleteUserIds = body.deleteUserIds || [];

    const allUsers = await this.db
      .select({ id: users.id, phone: users.phone, nickname: users.nickname })
      .from(users);

    let usersToDelete: { id: string; phone: string; nickname: string }[];
    if (deleteUserIds.length > 0) {
      usersToDelete = allUsers.filter(
        (u) => deleteUserIds.includes(u.id) && !keepPhones.includes(u.phone),
      );
    } else {
      usersToDelete = allUsers.filter((u) => !keepPhones.includes(u.phone));
    }

    const deleteIds = usersToDelete.map((u) => u.id);
    if (deleteIds.length === 0) {
      return { success: true, deletedCount: 0, users: [] };
    }

    const D = new Set(deleteIds);
    const ADMIN = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    const inD = (col: any) => inArray(col, deleteIds);
    const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
    // safe uuid IN-list for raw SQL
    const uuidList = sql.join(
      deleteIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    await this.db.transaction(async (tx) => {
      // 0. capture deleted users' upline before deleting (for subtree move)
      const delTeam = await tx
        .select({
          userId: teamRelations.userId,
          parentId: teamRelations.parentId,
          inviterId: teamRelations.inviterId,
        })
        .from(teamRelations)
        .where(inD(teamRelations.userId));
      const parentOf = new Map(delTeam.map((r) => [r.userId, r.parentId ?? null]));
      const inviterOf = new Map(delTeam.map((r) => [r.userId, r.inviterId ?? null]));

      // 1. team subtree move: remove deleted nodes from descendants' path;
      //    direct children re-attach to deleted node's parent
      const allTeam = await tx.select().from(teamRelations);
      const nextPos = new Map<string, number>();
      for (const row of allTeam) {
        if (D.has(row.userId)) continue;
        const segs = (row.path || '').split(',').filter(Boolean);
        const hit = segs.filter((s) => D.has(s));
        if (hit.length === 0) continue;
        const newPath = ',' + segs.filter((s) => !D.has(s)).join(',') + ',';
        let newParent = row.parentId;
        let newInviter = row.inviterId;
        let newPosition = row.position;
        if (row.parentId && D.has(row.parentId)) {
          newParent = parentOf.get(row.parentId) ?? null;
        }
        if (row.inviterId && D.has(row.inviterId)) {
          newInviter = inviterOf.get(row.inviterId) ?? null;
        }
        // re-attached direct child: allocate a free position under the new parent
        if (newParent !== row.parentId && newParent) {
          if (!nextPos.has(newParent)) {
            const maxr = await tx
              .select({
                m: sql<number>`coalesce(max(${teamRelations.position}), -1) + 1`,
              })
              .from(teamRelations)
              .where(eq(teamRelations.parentId, newParent));
            nextPos.set(newParent, Number(maxr[0].m));
          }
          newPosition = nextPos.get(newParent)!;
          nextPos.set(newParent, newPosition + 1);
        }
        await tx
          .update(teamRelations)
          .set({
            parentId: newParent,
            inviterId: newInviter,
            position: newPosition,
            treeLevel: Math.max(0, row.treeLevel - hit.length),
            path: newPath,
          })
          .where(eq(teamRelations.userId, row.userId));
      }

      // 2. products owned by D: cascade their orders first, then products
      const prods = await tx
        .select({ id: products.id })
        .from(products)
        .where(inD(products.sellerId));
      const prodIds = prods.map((x) => x.id);
      if (prodIds.length > 0) {
        const ords = await tx
          .select({ id: mallOrders.id })
          .from(mallOrders)
          .where(inArray(mallOrders.productId, prodIds));
        const ordIds = ords.map((x) => x.id);
        if (ordIds.length > 0) {
          await tx.delete(upgradeTasks).where(
            or(
              inArray(upgradeTasks.mallOrderId, ordIds),
              inArray(upgradeTasks.orderId, ordIds),
            ),
          );
          await tx.delete(mallOrders).where(inArray(mallOrders.id, ordIds));
        }
        await tx.delete(products).where(inArray(products.id, prodIds));
      }

      // 3. chat rooms created by D: transfer to admin if others remain, else cascade
      const rooms = await tx.select().from(chatRooms).where(inD(chatRooms.createdBy));
      for (const room of rooms) {
        const others = await tx
          .select({ id: chatRoomMembers.id })
          .from(chatRoomMembers)
          .where(
            and(
              eq(chatRoomMembers.roomId, room.id),
              notInArray(chatRoomMembers.userId, deleteIds),
            ),
          );
        if (others.length > 0) {
          await tx
            .update(chatRooms)
            .set({ createdBy: ADMIN })
            .where(eq(chatRooms.id, room.id));
        } else {
          await tx.delete(chatMessages).where(eq(chatMessages.roomId, room.id));
          await tx.delete(chatMicSlots).where(eq(chatMicSlots.roomId, room.id));
          await tx
            .delete(chatRoomApplications)
            .where(eq(chatRoomApplications.roomId, room.id));
          await tx
            .delete(chatRoomMembers)
            .where(eq(chatRoomMembers.roomId, room.id));
          await tx.delete(chatRooms).where(eq(chatRooms.id, room.id));
        }
      }

      // 4. meeting rooms created/hosted by D (raw SQL)
      const mrooms = rowsOf(
        await tx.execute(sql`
          select id, host_id, current_speaker_id, created_by
          from meeting_rooms
          where created_by in (${uuidList}) or host_id in (${uuidList})
        `),
      );
      for (const room of mrooms) {
        const other = rowsOf(
          await tx.execute(sql`
            select 1 as ok from meeting_presence
            where room_id = ${room.id} and user_id not in (${uuidList})
            limit 1
          `),
        );
        if (other.length > 0) {
          await tx.execute(sql`
            update meeting_rooms set
              host_id = ${ADMIN},
              current_speaker_id = case when current_speaker_id in (${uuidList})
                then null else current_speaker_id end,
              created_by = case when created_by in (${uuidList})
                then ${ADMIN} else created_by end,
              _updated_at = CURRENT_TIMESTAMP
            where id = ${room.id}
          `);
        } else {
          await tx.execute(sql`delete from meeting_messages where room_id = ${room.id}`);
          await tx.execute(sql`delete from meeting_presence where room_id = ${room.id}`);
          await tx.execute(sql`delete from meeting_hand_requests where room_id = ${room.id}`);
          await tx.execute(sql`delete from meeting_restrictions where room_id = ${room.id}`);
          await tx.execute(sql`delete from meeting_audio_chunks where room_id = ${room.id}`);
          await tx.execute(sql`delete from meeting_rooms where id = ${room.id}`);
        }
      }

      // 5. consult order protection: remove collection records / tasks referencing them
      const corders = await tx
        .select({ id: consultOrders.id })
        .from(consultOrders)
        .where(
          or(
            inD(consultOrders.studentId),
            inD(consultOrders.consultantId),
            inD(consultOrders.originalConsultantId),
          ),
        );
      const corderIds = corders.map((x) => x.id);
      if (corderIds.length > 0) {
        await tx
          .delete(platformCollectionRecords)
          .where(inArray(platformCollectionRecords.consultOrderId, corderIds));
        await tx
          .delete(upgradeTasks)
          .where(inArray(upgradeTasks.orderId, corderIds));
      }

      // 6. direct user-reference deletions
      await tx
        .delete(upgradeTasks)
        .where(or(inD(upgradeTasks.userId), inD(upgradeTasks.targetId)));
      await tx
        .delete(platformCollectionRecords)
        .where(inD(platformCollectionRecords.consultantId));
      await tx.delete(friends).where(or(inD(friends.userId), inD(friends.friendId)));
      await tx.delete(inviteRecords).where(
        or(inD(inviteRecords.inviterId), inD(inviteRecords.inviteeId)),
      );
      await tx.delete(managementFees).where(
        or(inD(managementFees.sellerId), inD(managementFees.confirmedBy)),
      );
      await tx.delete(cloneNotifications).where(
        or(
          inD(cloneNotifications.eligibleUserId),
          inD(cloneNotifications.eliminatedUserId),
          inD(cloneNotifications.cloneUserId),
        ),
      );
      // personal notifications only; broadcasts (user_id null) and created_by kept
      await tx.delete(systemNotifications).where(inD(systemNotifications.userId));
      await tx.delete(chatRoomApplications).where(
        or(
          inD(chatRoomApplications.userId),
          inD(chatRoomApplications.approvedBy),
        ),
      );
      await tx.delete(chatMessages).where(inD(chatMessages.userId));
      await tx.delete(chatMicSlots).where(inD(chatMicSlots.userId));
      await tx.delete(chatRoomMembers).where(inD(chatRoomMembers.userId));
      await tx.delete(consultOrders).where(
        or(
          inD(consultOrders.studentId),
          inD(consultOrders.consultantId),
          inD(consultOrders.originalConsultantId),
        ),
      );
      await tx
        .delete(mallOrders)
        .where(or(inD(mallOrders.userId), inD(mallOrders.sellerId)));

      // meeting subtables by user (raw SQL)
      await tx.execute(sql`
        delete from meeting_restrictions
        where user_id in (${uuidList}) or created_by in (${uuidList})
      `);
      await tx.execute(sql`delete from meeting_audio_chunks where speaker_id in (${uuidList})`);
      await tx.execute(sql`delete from meeting_hand_requests where user_id in (${uuidList})`);
      await tx.execute(sql`delete from meeting_messages where user_id in (${uuidList})`);
      await tx.execute(sql`delete from meeting_presence where user_id in (${uuidList})`);

      // 7. delete D team nodes, then users
      await tx.delete(teamRelations).where(inD(teamRelations.userId));
      await tx.delete(users).where(inD(users.id));
    });

    return {
      success: true,
      deletedCount: deleteIds.length,
      deletedUsers: usersToDelete,
    };
  }

  // ============================================================
  // 全用户关系树（懒加载）：按节点查直接下级，一个分支一个分支展开
  // ============================================================
  @Get('team/children')
  async getTeamChildren(@Query('userId') userId?: string) {
    const ROOT = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    const parentId = userId || ROOT;

    const shapeNode = {
      userId: teamRelations.userId,
      treeLevel: teamRelations.treeLevel,
      position: teamRelations.position,
      nickname: users.nickname,
      phone: users.phone,
      level: users.level,
      avatarUrl: users.avatarUrl,
      assessmentStatus: users.assessmentStatus,
      isSeller: users.isSeller,
    };

    const pRows = await this.db
      .select(shapeNode)
      .from(teamRelations)
      .innerJoin(users, eq(teamRelations.userId, users.id))
      .where(eq(teamRelations.userId, parentId))
      .limit(1);

    const cRows = await this.db
      .select(shapeNode)
      .from(teamRelations)
      .innerJoin(users, eq(teamRelations.userId, users.id))
      .where(eq(teamRelations.parentId, parentId))
      .orderBy(teamRelations.position, teamRelations.treeLevel);

    const childIds = cRows.map((r) => r.userId);
    const hcRows =
      childIds.length > 0
        ? await this.db
            .select({ pid: teamRelations.parentId })
            .from(teamRelations)
            .where(inArray(teamRelations.parentId, childIds))
        : [];
    const hcSet = new Set(hcRows.map((r) => r.pid));

    const fmt = (r: any) => ({
      userId: r.userId,
      nickname: r.nickname,
      phone: r.phone,
      level: r.level,
      avatarUrl: r.avatarUrl ?? undefined,
      assessmentStatus: r.assessmentStatus,
      isSeller: r.isSeller,
      treeLevel: r.treeLevel,
      position: r.position,
      hasChildren: hcSet.has(r.userId),
    });

    return {
      parent: pRows[0]
        ? { ...fmt(pRows[0]), hasChildren: cRows.length > 0 }
        : null,
      children: cRows.map(fmt),
    };
  }

  // 一次性合规修复：把不合规昵称末尾统一加汉字"了"（系统分身账号豁免）
  @Post('fix-nicknames')
  async fixNicknames(@Req() req: Request) {
    checkAdmin(req);
    const all = await this.db
      .select({ id: users.id, nickname: users.nickname })
      .from(users);

    const updated: { id: string; from: string; to: string }[] = [];
    for (const u of all) {
      const name = u.nickname || '';
      if (name.includes('分身')) continue; // 系统分身豁免
      if (!isValidNickname(name)) {
        const newName = name + '了';
        await this.db.update(users).set({ nickname: newName }).where(eq(users.id, u.id));
        updated.push({ id: u.id, from: name, to: newName });
      }
    }
    return { success: true, updatedCount: updated.length, updated };
  }

  // 获取卖家申请列表
  @Get('sellers')
  async getSellerList(@Req() req: Request, @Query('status') status?: string) {
    checkAdmin(req);
    let query = this.db.select().from(users).where(sql`is_seller = true`);
    if (status) {
      query = this.db.select().from(users).where(sql`is_seller = true AND seller_status = ${status}`);
    }
    const sellers = await query.orderBy(sql`_created_at DESC`);
    return { success: true, sellers };
  }

  // 审核卖家申请（通过/拒绝）
  @Post('sellers/:id/audit')
  async auditSeller(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    checkAdmin(req);
    const { action, remark } = body;
    if (!['approve', 'reject'].includes(action)) {
      return { success: false, message: '无效的操作类型' };
    }
    const sellerStatus = action === 'approve' ? 'approved' : 'rejected';
    await this.db.update(users).set({ isSeller: true, sellerStatus }).where(sql`id = ${id}`);
    return { success: true, sellerStatus, message: action === 'approve' ? '卖家审核通过' : '卖家申请已拒绝' };
  }

  // ============================================================
  // 推广费（管理费）审核
  // ============================================================

  @Get('management-fees')
  async getManagementFees(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllManagementFees(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      status,
    );
  }

  @Post('management-fees/:id/confirm')
  async confirmManagementFee(@Req() req: Request, @Param('id') id: string) {
    checkAdmin(req);
    return this.adminService.confirmManagementFee(req.user.userId, id);
  }

  // 四星考核返还列表（待打款/已打款）
  @Get('refunds')
  async getRefunds() {
    return this.adminService.getRefundList();
  }

  // 确认四星返还已线下打款
  @Post('refunds/:userId/confirm')
  async confirmRefund(@Req() req: Request, @Param('userId') userId: string) {
    checkAdmin(req);
    return this.adminService.confirmRefundPayment(req.user.userId, userId);
  }

}
