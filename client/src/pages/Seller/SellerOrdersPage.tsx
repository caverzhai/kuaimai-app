import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { ArrowLeft, ShoppingCart, Check, X, Package } from 'lucide-react';

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
  createdAt: string;
}

const STATUS_NAMES: Record<string, string> = {
  pending_payment: '待付款',
  pending_review: '待审核',
  pending_shipment: '待发货',
  pending_delivery: '待收货',
  completed: '已完成',
  cancelled: '已取消',
};

export default function SellerOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MallOrderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    loadOrders();
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
      alert('已确认收款');
      loadOrders();
    } catch (e: any) {
      alert(e?.response?.data?.message || '操作失败');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
          {['', 'pending_review', 'pending_shipment', 'completed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                filter === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
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
              {/* 订单号和状态 */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-700">订单号：{order.orderNo}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className={`text-sm font-medium ${
                  order.status === 'pending_review' ? 'text-orange-500' :
                  order.status === 'pending_shipment' ? 'text-blue-500' :
                  order.status === 'completed' ? 'text-green-500' : 'text-gray-500'
                }`}>
                  {STATUS_NAMES[order.status] || order.status}
                </span>
              </div>

              {/* 商品信息 */}
              <div className="flex items-center gap-3 mb-3">
                {order.productImage && (
                  <img
                    src={order.productImage}
                    alt={order.productName}
                    className="w-14 h-14 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{order.productName}</div>
                  <div className="text-sm text-gray-500">
                    ¥{order.totalAmount} × {order.quantity}
                  </div>
                </div>
              </div>

              {/* 收货信息 */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                <div className="font-medium text-gray-700 mb-1">收货信息</div>
                <div className="text-gray-600">收货人：{order.receiveName || '-'}</div>
                <div className="text-gray-600">电话：{order.receivePhone || '-'}</div>
                <div className="text-gray-600">地址：{order.receiveAddress || '-'}</div>
              </div>

              {/* 付款截图 */}
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

              {/* 操作按钮 */}
              {order.status === 'pending_review' && (
                <button
                  onClick={() => handleConfirmPayment(order.id)}
                  className="w-full py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600"
                >
                  <Check size={18} className="inline mr-1" />
                  确认收款，开始发货
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
