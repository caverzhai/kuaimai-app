import { Module } from '@nestjs/common';
import { IosEnrollService } from './ios-enroll.service';
import {
  IosEnrollApiController,
  IosEnrollPublicController,
} from './ios-enroll.controller';

@Module({
  controllers: [IosEnrollApiController, IosEnrollPublicController],
  providers: [IosEnrollService],
  exports: [IosEnrollService],
})
export class IosEnrollModule {}
