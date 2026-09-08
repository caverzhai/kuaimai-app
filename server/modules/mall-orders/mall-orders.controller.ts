import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '@server/common/guards/auth.guard';
import { MallOrdersService } from './mall-orders.service';
import type {
  MallOrderInfo,
  CreateMallOrderDTO,
  MallOrderListResponse,
  PaymentScreenshotDTO,
} from '@shared/api.interface';

@Controller('api/mall-orders')
export class MallOrdersController {
  constructor(private readonly mallOrdersService: MallOrdersService) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateMallOrderDTO,
  ): Promise<MallOrderInfo> {
    const userId = req.user!.userId;
    return this.mallOrdersService.create(userId, dto);
  }

  @UseGuards(AuthGuard)
  @Get('my')
  async getMyOrders(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('status') status?: string,
  ): Promise<MallOrderListResponse> {
    const userId = req.user!.userId;
    return this.mallOrdersService.getMyOrders(
      userId,
      parseInt(page, 10),
      parseInt(pageSize, 10),
      status,
    );
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async getDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<MallOrderInfo> {
    const userId = req.user!.userId;
    return this.mallOrdersService.getOrderDetail(userId, id);
  }

  @UseGuards(AuthGuard)
  @Post(':id/payment')
  async uploadPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PaymentScreenshotDTO,
  ): Promise<MallOrderInfo> {
    const userId = req.user!.userId;
    return this.mallOrdersService.uploadPaymentScreenshot(userId, id, dto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/confirm-delivery')
  async confirmDelivery(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<MallOrderInfo> {
    const userId = req.user!.userId;
    return this.mallOrdersService.confirmDelivery(userId, id);
  }
}
