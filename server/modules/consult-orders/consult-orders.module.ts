import { Module } from '@nestjs/common';
import { ConsultOrdersController } from './consult-orders.controller';
import { ConsultOrdersService } from './consult-orders.service';
import { UpgradeModule } from '../upgrade/upgrade.module';
import { PendingOrdersModule } from '../pending-orders/pending-orders.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UpgradeModule, PendingOrdersModule, NotificationsModule],
  controllers: [ConsultOrdersController],
  providers: [ConsultOrdersService],
})
export class ConsultOrdersModule {}
