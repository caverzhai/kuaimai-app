import {
  Body,
  Controller,
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
import { AdminService } from './admin.service';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { upgradeTasks, users, mallOrders, consultOrders, teamRelations, inviteRecords } from '@server/database/schema';
import { inArray, sql } from 'drizzle-orm';

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
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

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

  // 批量删除用户（保留指定手机号的用户）
  @Post('users/batch-delete')
  async batchDeleteUsers(
    @Req() req: Request,
    @Body() body: { keepPhones: string[] },
  ) {
    checkAdmin(req);
    const keepPhones = body.keepPhones || [];

    // 查出所有用户
    const allUsers = await this.db
      .select({ id: users.id, phone: users.phone, nickname: users.nickname })
      .from(users);

    // 过滤出要删除的用户
    const usersToDelete = allUsers.filter((u) => !keepPhones.includes(u.phone));
    const deleteIds = usersToDelete.map((u) => u.id);

    if (deleteIds.length === 0) {
      return { success: true, deletedCount: 0, users: [] };
    }

    // 删除关联数据（顺序：先子表后主表）
    // 1. 删除升级任务
    await this.db.delete(upgradeTasks).where(inArray(upgradeTasks.userId, deleteIds));
    // 2. 删除商城订单
    await this.db.delete(mallOrders).where(inArray(mallOrders.userId, deleteIds));
    // 3. 删除咨询订单（作为学员）
    await this.db.delete(consultOrders).where(inArray(consultOrders.studentId, deleteIds));
    // 4. 删除咨询订单（作为咨询师）
    await this.db.delete(consultOrders).where(inArray(consultOrders.consultantId, deleteIds));
    // 5. 删除团队关系（作为下级）
    await this.db.delete(teamRelations).where(inArray(teamRelations.userId, deleteIds));
    // 6. 删除团队关系（作为上级）
    await this.db.delete(teamRelations).where(inArray(teamRelations.parentId, deleteIds));
    // 7. 删除邀请记录（作为邀请人）
    await this.db.delete(inviteRecords).where(inArray(inviteRecords.inviterId, deleteIds));
    // 8. 删除邀请记录（作为被邀请人）
    await this.db.delete(inviteRecords).where(inArray(inviteRecords.inviteeId, deleteIds));
    // 9. 删除商品（如果有的话）
    // await this.db.delete(products).where(inArray(products.sellerId, deleteIds));
    // 10. 最后删除用户
    await this.db.delete(users).where(inArray(users.id, deleteIds));

    return {
      success: true,
      deletedCount: deleteIds.length,
      deletedUsers: usersToDelete,
    };
  }
}
