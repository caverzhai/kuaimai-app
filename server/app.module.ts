import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';

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

@Module({
  imports: [
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
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
