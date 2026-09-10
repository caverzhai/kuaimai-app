import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConsultantsService } from './consultants.service';
import { AuthGuard } from '@server/common/guards/auth.guard';
import type {
  ConsultantListQuery,
  ConsultantListResponse,
  IndustryInfo,
} from '@shared/api.interface';

@Controller('api/consultants')
export class ConsultantsController {
  constructor(private readonly consultantsService: ConsultantsService) {}

  @Get('industries')
  async getIndustries(): Promise<IndustryInfo[]> {
    return this.consultantsService.getIndustries();
  }

  @UseGuards(AuthGuard)
  @Get()
  async getConsultantList(
    @Req() req: Request,
    @Query() query: ConsultantListQuery,
  ): Promise<ConsultantListResponse> {
    return this.consultantsService.getConsultantList(query);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async getConsultantDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    return this.consultantsService.getConsultantDetail(id);
  }
}
