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
import { ConsultOrdersService } from './consult-orders.service';
import type {
  ConsultOrderInfo,
  CreateConsultOrderDTO,
  ConsultOrderListResponse,
  PaymentScreenshotDTO,
  WorkScreenshotDTO,
  ReviewDTO,
} from '@shared/api.interface';

@Controller('api/consult-orders')
export class ConsultOrdersController {
  constructor(
    private readonly consultOrdersService: ConsultOrdersService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateConsultOrderDTO,
  ): Promise<ConsultOrderInfo> {
    const userId = req.user!.userId;
    const isInvited = req.user!.isInvited;
    return this.consultOrdersService.create(userId, isInvited, dto);
  }

  @UseGuards(AuthGuard)
  @Get('my')
  async getMyOrders(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('status') status?: string,
  ): Promise<ConsultOrderListResponse> {
    const userId = req.user!.userId;
    return this.consultOrdersService.getStudentOrders(
      userId,
      parseInt(page, 10),
      parseInt(pageSize, 10),
      status,
    );
  }

  @UseGuards(AuthGuard)
  @Get('received')
  async getReceivedOrders(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('status') status?: string,
  ): Promise<ConsultOrderListResponse> {
    const userId = req.user!.userId;
    return this.consultOrdersService.getConsultantOrders(
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
  ): Promise<ConsultOrderInfo> {
    const userId = req.user!.userId;
    return this.consultOrdersService.getOrderDetail(userId, id);
  }

  @UseGuards(AuthGuard)
  @Post(':id/payment')
  async uploadPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PaymentScreenshotDTO,
  ): Promise<ConsultOrderInfo> {
    const userId = req.user!.userId;
    return this.consultOrdersService.uploadPaymentScreenshot(userId, id, dto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/confirm-payment')
  async confirmPayment(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ConsultOrderInfo> {
    const userId = req.user!.userId;
    return this.consultOrdersService.confirmPayment(userId, id);
  }

  @UseGuards(AuthGuard)
  @Post(':id/work')
  async uploadWork(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: WorkScreenshotDTO,
  ): Promise<ConsultOrderInfo> {
    const userId = req.user!.userId;
    return this.consultOrdersService.uploadWork(userId, id, dto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/review-work')
  async reviewWork(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReviewDTO,
  ): Promise<ConsultOrderInfo> {
    const userId = req.user!.userId;
    return this.consultOrdersService.reviewWork(userId, id, dto);
  }
}
