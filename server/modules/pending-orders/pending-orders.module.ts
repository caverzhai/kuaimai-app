import { Module } from '@nestjs/common';
import { PendingOrdersService } from './pending-orders.service';

@Module({
  providers: [PendingOrdersService],
  exports: [PendingOrdersService],
})
export class PendingOrdersModule {}
