import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export type PendingOrder = {
  kind: 'mall' | 'consult';
  id: string;
  orderNo: string;
  amount: string;
};

/**
 * 聚合查询当前用户是否存在"待付款"订单（商城订单 + 咨询单）。
 * 取最早一笔返回；没有则返回 null。失败时静默返回 null，不阻断页面。
 */
export async function getPendingOrder(): Promise<PendingOrder | null> {
  try {
    const [mallResp, consultResp] = await Promise.all([
      axiosForBackend({
        url: '/api/mall-orders/my',
        method: 'GET',
        params: { page: 1, pageSize: 1, status: 'pending_payment' },
      }).catch(() => ({ data: { items: [] } })),
      axiosForBackend({
        url: '/api/consult-orders/my',
        method: 'GET',
        params: { page: 1, pageSize: 1, status: 'pending_payment' },
      }).catch(() => ({ data: { items: [] } })),
    ]);

    const mallItem = mallResp?.data?.items?.[0];
    if (mallItem) {
      return {
        kind: 'mall',
        id: mallItem.id,
        orderNo: mallItem.orderNo,
        amount: String(mallItem.totalAmount ?? ''),
      };
    }

    const consultItem = consultResp?.data?.items?.[0];
    if (consultItem) {
      return {
        kind: 'consult',
        id: consultItem.id,
        orderNo: consultItem.orderNo,
        amount: String(consultItem.amount ?? ''),
      };
    }

    return null;
  } catch {
    return null;
  }
}
