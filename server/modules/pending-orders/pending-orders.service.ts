import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import { findPendingPayment, buildPendingPaymentError } from '../../common/utils/pending-order.util';

@Injectable()
export class PendingOrdersService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: any) {}

  // 全局待付款检查：存在未付款订单则抛 400 拦截，否则放行
  async assertNoPending(userId: string): Promise<void> {
    const p = await findPendingPayment(this.db, userId);
    if (p) {
      throw new BadRequestException(buildPendingPaymentError(p));
    }
  }
}
