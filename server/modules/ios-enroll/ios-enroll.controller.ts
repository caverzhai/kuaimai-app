import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthGuard } from '@server/common/guards/auth.guard';
import { IosEnrollService } from './ios-enroll.service';

const ADMIN_PHONES = ['13800000000'];

// 受登录保护的 JSON 接口
@Controller('api/ios-enroll')
export class IosEnrollApiController {
  constructor(private readonly iosEnrollService: IosEnrollService) {}

  private ensureAdmin(req: Request) {
    const phone = req.user?.phone;
    if (!phone || !ADMIN_PHONES.includes(phone)) {
      throw new ForbiddenException('无管理员权限');
    }
  }

  // 会员发起申请：生成一次性令牌 + 专属链接
  @Post('start')
  @UseGuards(AuthGuard)
  async start(@Req() req: Request) {
    return await this.iosEnrollService.start(
      req.user!.userId,
      req.user!.level,
    );
  }

  // 会员查看自己已上报的设备
  @Get('my')
  @UseGuards(AuthGuard)
  async my(@Req() req: Request) {
    return await this.iosEnrollService.myDevices(req.user!.userId);
  }

  // 管理员：全部申请名单
  @Get('list')
  @UseGuards(AuthGuard)
  async list(@Req() req: Request) {
    this.ensureAdmin(req);
    return await this.iosEnrollService.listAll();
  }

  // 管理员：标记打包状态
  @Post('mark')
  @UseGuards(AuthGuard)
  async mark(
    @Req() req: Request,
    @Body() body: { id: string; status: 'pending' | 'packaged' },
  ) {
    this.ensureAdmin(req);
    return await this.iosEnrollService.setStatus(body?.id, body?.status);
  }
}

// 公开路由（iPhone Safari 访问，不走鉴权，返回描述文件）
@Controller('ios-enroll')
export class IosEnrollPublicController {
  constructor(private readonly iosEnrollService: IosEnrollService) {}

  // 下载 enroll 描述文件
  @Get('profile')
  async profile(@Query('token') token: string, @Res() res: Response) {
    try {
      await this.iosEnrollService.validateEnrollToken(token ?? '');
    } catch (err: any) {
      res.status(400).send(err?.message ?? '申请链接无效，请在 App 内重新生成');
      return;
    }
    const xml = this.iosEnrollService.buildEnrollProfile(token);
    res.setHeader(
      'Content-Type',
      'application/x-apple-aspen-config; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ai-kuaimai-enroll.mobileconfig"',
    );
    res.status(200).send(xml);
  }

  // 设备回传设备属性（plist），返回最终描述文件以走完安装流程
  @Post('register')
  async register(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const body = typeof req.body === 'string' ? req.body : '';
    try {
      const { profileXml } = await this.iosEnrollService.register(
        token ?? '',
        body,
      );
      res.setHeader(
        'Content-Type',
        'application/x-apple-aspen-config; charset=utf-8',
      );
      res.status(200).send(profileXml);
    } catch (err: any) {
      res.status(400).send(err?.message ?? '设备登记失败，请重新扫码');
    }
  }
}
