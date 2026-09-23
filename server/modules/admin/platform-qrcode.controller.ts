import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@server/common/guards/auth.guard';
import { AdminService } from './admin.service';
import type { PlatformQrcodeInfo } from '@shared/api.interface';

/**
 * 平台收款码公开查询接口（只需登录）。
 * 卖家交推广费、买家下单等场景都需要查看平台收款码，
 * 不能放在 /api/admin/* 下（那里有 AdminGuard 会拦截非管理员）。
 */
@Controller('api/platform-qrcode')
@UseGuards(AuthGuard)
export class PlatformQrcodeController {
  constructor(private readonly adminService: AdminService) {}

  @Get(':type')
  async getPlatformQrcode(@Param('type') type: string): Promise<PlatformQrcodeInfo> {
    return this.adminService.getPlatformQrcode(type);
  }
}
