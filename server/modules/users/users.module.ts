import { Module } from '@nestjs/common';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthController } from './auth.controller';

@Module({
  controllers: [UsersController, AuthController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
