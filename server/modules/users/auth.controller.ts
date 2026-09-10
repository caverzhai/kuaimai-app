import { Body, Controller, Post } from '@nestjs/common';

import { UsersService } from './users.service';
import type {
  LoginResponse,
  UserLoginDTO,
  UserRegisterDTO,
} from '@shared/api.interface';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() dto: UserRegisterDTO): Promise<LoginResponse> {
    return this.usersService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: UserLoginDTO): Promise<LoginResponse> {
    return this.usersService.login(dto);
  }
}
