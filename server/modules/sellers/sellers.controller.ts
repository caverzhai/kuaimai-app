import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SellersService } from './sellers.service';

@Controller('api/seller')
@UseGuards(AuthGuard)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  private sellerId(req: any) {
    return req.user.userId;
  }

  // ==================== 商品管理 ====================

  /** 获取商家商品列表 */
  @Get('products')
  async getProducts(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
  ) {
    return this.sellersService.getSellerProducts(
      this.sellerId(req),
      parseInt(page, 10),
      parseInt(pageSize, 10),
      status,
    );
  }

  /** 卖家不能上传商品，仅管理员可上传 */
  @Post('products')
  async createProduct(@Req() req: any, @Body() body: any) {
    return { success: false, message: '卖家身份仅用于收款，不能上传商品，请联系管理员上架商品' };
  }

  /** 卖家不能编辑商品，仅管理员可编辑 */
  @Patch('products/:id')
  async updateProduct(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return { success: false, message: '卖家身份仅用于收款，不能编辑商品，请联系管理员' };
  }

  /** 卖家不能上下架商品，仅管理员可操作 */
  @Post('products/:id/toggle-status')
  async toggleProductStatus(@Req() req: any, @Param('id') id: string) {
    return { success: false, message: '卖家身份仅用于收款，不能上下架商品，请联系管理员' };
  }

  // ==================== 订单管理 ====================

  /** 获取商家订单列表 */
  @Get('orders')
  async getOrders(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
  ) {
    return this.sellersService.getSellerOrders(
      this.sellerId(req),
      parseInt(page, 10),
      parseInt(pageSize, 10),
      status,
    );
  }

  /** 商家发货 */
  @Post('orders/:id/ship')
  async shipOrder(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.sellersService.sellerShipOrder(this.sellerId(req), id, dto);
  }

  // ==================== 管理费（佣金）管理 ====================

  /** 获取商家管理费列表 */
  @Get('management-fees')
  async getManagementFees(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
  ) {
    return this.sellersService.getSellerManagementFees(
      this.sellerId(req),
      parseInt(page, 10),
      parseInt(pageSize, 10),
      status,
    );
  }

  /** 商家支付管理费（上传支付凭证） */
  @Post('management-fees/:id/pay')
  async payManagementFee(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.sellersService.payManagementFee(this.sellerId(req), id, body.screenshotUrl);
  }

  // ==================== 统计 ====================

  /** 获取商家统计数据 */
  @Get('stats')
  async getStats(@Req() req: any) {
    return this.sellersService.getSellerStats(this.sellerId(req));
  }

  // ==================== 商家申请 ====================

  /** 申请成为商家 */
  @Post('apply')
  async apply(@Req() req: any, @Body() dto: any) {
    return this.sellersService.applySeller(this.sellerId(req), dto);
  }
}
