import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

import { UsersService } from './users.service';
import type {
  LoginResponse,
  UserLoginDTO,
  UserRegisterDTO,
} from '@shared/api.interface';

@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  // 注册：每分钟最多5次
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: UserRegisterDTO): Promise<LoginResponse> {
    return this.usersService.register(dto);
  }

  // 登录：每分钟最多10次（防暴力破解）
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: UserLoginDTO): Promise<LoginResponse> {
    return this.usersService.login(dto);
  }
}
