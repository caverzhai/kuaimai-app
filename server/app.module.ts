import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { MallOrdersModule } from './modules/mall-orders/mall-orders.module';
import { ConsultOrdersModule } from './modules/consult-orders/consult-orders.module';
import { ConsultantsModule } from './modules/consultants/consultants.module';
import { UpgradeModule } from './modules/upgrade/upgrade.module';
import { TeamModule } from './modules/team/team.module';
import { AdminModule } from './modules/admin/admin.module';
import { UploadModule } from './modules/upload/upload.module';
import { ChatRoomsModule } from './modules/chat-rooms/chat-rooms.module';
import { ChatMessagesModule } from './modules/chat-messages/chat-messages.module';
import { FriendsModule } from './modules/friends/friends.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { SellersModule } from './modules/sellers/sellers.module';

@Module({
  imports: [
    // 全局频率限制：每分钟最多60次请求（登录/注册等敏感接口有更严格的单独限制）
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60秒
        limit: 60,   // 最多60次
      },
    ]),
    DatabaseModule,
    UsersModule,
    ProductsModule,
    MallOrdersModule,
    ConsultOrdersModule,
    ConsultantsModule,
    UpgradeModule,
    TeamModule,
    AdminModule,
    UploadModule,
    ChatRoomsModule,
    ChatMessagesModule,
    FriendsModule,
    OcrModule,
    SellersModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
