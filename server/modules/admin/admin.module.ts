import { Module } from '@nestjs/common';

import { ProductsModule } from '@server/modules/products/products.module';
import { UpgradeModule } from '@server/modules/upgrade/upgrade.module';
import { AdminController } from './admin.controller';
import { FinanceController } from './finance.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ProductsModule, UpgradeModule],
  controllers: [AdminController, FinanceController],
  providers: [AdminService],
})
export class AdminModule {}
