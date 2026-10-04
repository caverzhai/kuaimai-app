import { and, eq } from 'drizzle-orm';
import { mallOrders, consultOrders } from '../../database/schema';

export type PendingPaymentInfo = {
  kind: 'mall' | 'consult';
  orderNo: string;
};

/**
 * 全局"待付款"检查：同一用户在商城订单或咨询订单任一表中，
 * 只要存在一笔 status=pending_payment（已创建、尚未上传付款凭证）的订单，
 * 就返回该订单信息；都没有则返回 null。
 *
 * 已上传付款凭证（pending_review / pending_confirm，等待审核）不在此列，
 * 以符合"上传付款图即可开始下一任务、不必等审核"的规则。
 */
export async function findPendingPayment(
  db: any,
  userId: string,
): Promise<PendingPaymentInfo | null> {
  const mall = await db
    .select({ orderNo: mallOrders.orderNo })
    .from(mallOrders)
    .where(and(
      eq(mallOrders.userId, userId),
      eq(mallOrders.status, 'pending_payment'),
    ))
    .limit(1);
  if (mall.length > 0) {
    return { kind: 'mall', orderNo: mall[0].orderNo };
  }

  const consult = await db
    .select({ orderNo: consultOrders.orderNo })
    .from(consultOrders)
    .where(and(
      eq(consultOrders.studentId, userId),
      eq(consultOrders.status, 'pending_payment'),
    ))
    .limit(1);
  if (consult.length > 0) {
    return { kind: 'consult', orderNo: consult[0].orderNo };
  }

  return null;
}

/**
 * 有待付款订单时统一抛出的拦截提示，引导新手先完成支付。
 */
export function buildPendingPaymentError(p: PendingPaymentInfo): string {
  const where = p.kind === 'mall' ? '「我的订单-待付款」' : '「任务中心 / 我的咨询单-待付款」';
  return (
    '您有一笔尚未付款的订单（订单号：' +
    p.orderNo +
    '），请先到' +
    where +
    '完成付款；付款成功后才能继续拍下或领取下一个任务，避免产生重复订单'
  );
}
