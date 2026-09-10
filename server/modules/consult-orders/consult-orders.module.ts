import { Module } from '@nestjs/common';
import { ConsultOrdersController } from './consult-orders.controller';
import { ConsultOrdersService } from './consult-orders.service';
import { UpgradeModule } from '../upgrade/upgrade.module';

@Module({
  imports: [UpgradeModule],
  controllers: [ConsultOrdersController],
  providers: [ConsultOrdersService],
})
export class ConsultOrdersModule {}
