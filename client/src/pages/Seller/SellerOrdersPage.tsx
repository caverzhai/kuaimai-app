import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { ArrowLeft, Check, Package, Truck } from 'lucide-react';

interface MallOrderInfo {
  id: string;
  orderNo: string;
  productName: string;
  productImage: string;
  totalAmount: string;
  quantity: number;
  status: string;
  receiveName: string;
  receivePhone: string;
  receiveAddress: string;
  paymentScreenshotUrl?: string;
  logisticsCompany?: string;
  logisticsNo?: string;
  createdAt: string;
}

const STATUS_NAMES: Record<string, string> = {
  pending_payment: '待付款',
  pending_review: '待确认收款',
  pending_shipment: '待发货',
  pending_delivery: '待收货',
  completed: '已完成',
  cancelled: '已取消',
};

const FILTERS = ['', 'pending_review', 'pending_shipment', 'pending_delivery', 'completed'];

export default function SellerOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MallOrderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  // 发货表单
  const [shipOrder, setShipOrder] = useState<MallOrderInfo | null>(null);
  const [shipType, setShipType] = useState<'express' | 'self_pickup' | 'no_logistics'>('express');
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: '1', pageSize: '50' };
      if (filter) params.status = filter;
      const res = await axiosForBackend.get('/api/mall-orders/seller/orders', { params });
      const data = res.data as { items: MallOrderInfo[] };
      setOrders(data.items || []);
    } catch (e) {
      console.error('加载订单失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    try {
      await axiosForBackend.post(`/api/mall-orders/${orderId}/seller-confirm-payment`);
      alert('已确认收款，请尽快发货');
      loadOrders();
    } catch (e: any) {
      alert(e?.response?.data?.message || '操作失败');
    }
  };

  const openShip = (order: MallOrderInfo) => {
    setShipOrder(order);
    setShipType('express');
    setLogisticsCompany('');
    setLogisticsNo('');
  };

  const handleShip = async () => {
    if (!shipOrder) return;
    if (shipType === 'express') {
      if (!logisticsCompany.trim() || !logisticsNo.trim()) {
        alert('请填写物流公司和物流单号');
        return;
      }
    }
    try {
      setSubmitting(true);
      await axiosForBackend.post(`/api/mall-orders/${shipOrder.id}/seller-ship`, {
        shipType,
        logisticsCompany: shipType === 'express' ? logisticsCompany.trim() : undefined,
        logisticsNo: shipType === 'express' ? logisticsNo.trim() : undefined,
      });
      alert('发货成功');
      setShipOrder(null);
      loadOrders();
    } catch (e: any) {
      alert(e?.response?.data?.message || '发货失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">卖家订单管理</h1>
        </div>
        {/* 状态筛选 */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                filter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {s === '' ? '全部' : STATUS_NAMES[s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* 订单列表 */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package size={48} className="mx-auto mb-3 text-gray-300" />
            暂无订单
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-700">订单号：{order.orderNo}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(order.createdAt).toLocaleString()}</div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    order.status === 'pending_review'
                      ? 'text-orange-500'
                      : order.status === 'pending_shipment'
                      ? 'text-blue-500'
                      : order.status === 'completed'
                      ? 'text-green-500'
                      : 'text-gray-500'
                  }`}
                >
                  {STATUS_NAMES[order.status] || order.status}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                {order.productImage && (
                  <img src={order.productImage} alt={order.productName} className="w-14 h-14 object-cover rounded-lg" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{order.productName}</div>
                  <div className="text-sm text-gray-500">
                    ¥{order.totalAmount} × {order.quantity}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                <div className="font-medium text-gray-700 mb-1">收货信息</div>
                <div className="text-gray-600">收货人：{order.receiveName || '-'}</div>
                <div className="text-gray-600">电话：{order.receivePhone || '-'}</div>
                <div className="text-gray-600">地址：{order.receiveAddress || '-'}</div>
              </div>

              {order.paymentScreenshotUrl && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">付款截图</div>
                  <img
                    src={order.paymentScreenshotUrl}
                    alt="付款截图"
                    className="max-w-[200px] max-h-[200px] object-contain rounded-lg border"
                  />
                </div>
              )}

              {/* 物流信息 */}
              {order.logisticsCompany && (
                <div className="mb-3 bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-blue-700 mb-1 flex items-center gap-1">
                    <Truck size={16} /> 发货信息
                  </div>
                  <div className="text-blue-700">方式：{order.logisticsCompany}</div>
                  {order.logisticsNo && <div className="text-blue-700">单号：{order.logisticsNo}</div>}
                </div>
              )}

              {/* 操作按钮 */}
              {order.status === 'pending_review' && (
                <button
                  onClick={() => handleConfirmPayment(order.id)}
                  className="w-full py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600"
                >
                  <Check size={18} className="inline mr-1" />
                  确认收款
                </button>
              )}
              {order.status === 'pending_shipment' && (
                <button
                  onClick={() => openShip(order)}
                  className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600"
                >
                  <Truck size={18} className="inline mr-1" />
                  立即发货
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* 发货弹窗 */}
      {shipOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setShipOrder(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">订单发货</h2>

            {/* 履约方式 */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">履约方式</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'express', label: '快递物流' },
                  { v: 'self_pickup', label: '到店自提' },
                  { v: 'no_logistics', label: '无需物流' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setShipType(opt.v as any)}
                    className={`py-2 rounded-lg text-sm border ${
                      shipType === opt.v
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {shipType === 'express' && (
              <>
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">物流公司</div>
                  <input
                    value={logisticsCompany}
                    onChange={(e) => setLogisticsCompany(e.target.value)}
                    placeholder="如：顺丰、中通、圆通"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">物流单号</div>
                  <input
                    value={logisticsNo}
                    onChange={(e) => setLogisticsNo(e.target.value)}
                    placeholder="请输入快递单号"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {shipType === 'self_pickup' && (
              <div className="mb-4 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                买家将到店自行提货，确认后订单进入待收货状态，20分钟后自动完成。
              </div>
            )}
            {shipType === 'no_logistics' && (
              <div className="mb-4 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                无需物流配送（同城配送/虚拟商品等），确认后订单进入待收货状态，20分钟后自动完成。
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShipOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleShip}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认发货'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
