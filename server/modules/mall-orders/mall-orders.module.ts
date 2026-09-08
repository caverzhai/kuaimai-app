import { Module } from '@nestjs/common';
import { MallOrdersController } from './mall-orders.controller';
import { MallOrdersService } from './mall-orders.service';

@Module({
  controllers: [MallOrdersController],
  providers: [MallOrdersService],
})
export class MallOrdersModule {}
