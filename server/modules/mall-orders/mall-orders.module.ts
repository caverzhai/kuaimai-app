import { Module } from '@nestjs/common';
import { MallOrdersController } from './mall-orders.controller';
import { MallOrdersService } from './mall-orders.service';
import { UpgradeModule } from '../upgrade/upgrade.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UpgradeModule, NotificationsModule],
  controllers: [MallOrdersController],
  providers: [MallOrdersService],
})
export class MallOrdersModule {}