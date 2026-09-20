import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

// 管理员手机号列表（可通过环境变量配置，多个用逗号分隔）
const ADMIN_PHONES = (process.env.ADMIN_PHONES || '13800000000')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未登录');
    }

    if (!ADMIN_PHONES.includes(user.phone)) {
      throw new ForbiddenException('需要管理员权限');
    }

    return true;
  }
}
