import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Package,
  PackageCheck,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyMallOrders,
  confirmMallDelivery,
} from '../../api';
import {
  MALL_ORDER_STATUS,
  MALL_ORDER_STATUS_NAMES,
} from '@shared/api.interface';
import type { MallOrderInfo, MallOrderListResponse } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const TABS = [
  { key: '', label: '全部', icon: Package },
  { key: MALL_ORDER_STATUS.PENDING_PAYMENT, label: '待付款', icon: CreditCard },
  { key: MALL_ORDER_STATUS.PENDING_REVIEW, label: '待审核', icon: Clock },
  { key: MALL_ORDER_STATUS.PENDING_SHIPMENT, label: '待发货', icon: Package },
  { key: MALL_ORDER_STATUS.PENDING_DELIVERY, label: '待收货', icon: PackageCheck },
  { key: MALL_ORDER_STATUS.COMPLETED, label: '已完成', icon: CheckCircle2 },
];

const PAGE_SIZE = 10;

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('');
  const [orders, setOrders] = useState<MallOrderInfo[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // 每秒更新当前时间，用于倒计时显示
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 格式化倒计时
  const formatCountdown = (deadline: string): string => {
    const remain = new Date(deadline).getTime() - now;
    if (remain <= 0) return '即将自动确认';
    const mins = Math.floor(remain / 60000);
    const secs = Math.floor((remain % 60000) / 1000);
    return `${mins}分${secs.toString().padStart(2, '0')}秒后自动确认`;
  };

  const fetchOrders = useCallback(
    async (p: number, replace: boolean, status: string) => {
      try {
        if (replace) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);
        const params: Record<string, unknown> = {
          page: p,
          pageSize: PAGE_SIZE,
        };
        if (status) params.status = status;
        const data = (await getMyMallOrders(params)) as MallOrderListResponse;
        setOrders((prev) => (replace ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        setPage(p);
      } catch (err) {
        logger.error('获取订单列表失败', err);
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (authLoading || !user) return;
    setPage(1);
    setOrders([]);
    fetchOrders(1, true, activeTab);
  }, [activeTab, fetchOrders, authLoading, user]);

  function handleLoadMore() {
    fetchOrders(page + 1, false, activeTab);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleConfirmDelivery(orderId: string) {
    try {
      setConfirmingId(orderId);
      await confirmMallDelivery(orderId);
      // 刷新当前列表
      fetchOrders(1, true, activeTab);
    } catch (err) {
      logger.error('确认收货失败', err);
      setError('确认收货失败，请稍后重试');
    } finally {
      setConfirmingId(null);
    }
  }

  function handleBuyAgain(productId: string) {
    navigate(`/product/${productId}`);
  }

  function handlePay(orderId: string) {
    // 跳转到订单详情/支付页，这里简化为跳回确认页（需productId，从订单取）
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      navigate(`/order-confirm/${order.productId}?quantity=${order.quantity}`);
    }
  }

  const statusColor: Record<string, string> = {
    [MALL_ORDER_STATUS.PENDING_PAYMENT]: 'text-orange-500 bg-orange-50',
    [MALL_ORDER_STATUS.PENDING_REVIEW]: 'text-yellow-600 bg-yellow-50',
    [MALL_ORDER_STATUS.PENDING_SHIPMENT]: 'text-blue-500 bg-blue-50',
    [MALL_ORDER_STATUS.PENDING_DELIVERY]: 'text-purple-500 bg-purple-50',
    [MALL_ORDER_STATUS.COMPLETED]: 'text-green-600 bg-green-50',
    [MALL_ORDER_STATUS.CANCELLED]: 'text-gray-500 bg-gray-100',
  };

  const hasMore = orders.length < total;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">我的订单</h1>
        </div>
      </div>

      {/* 状态tab */}
      <div className="sticky top-12 z-10 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-2">
          <div className="flex overflow-x-auto -mx-2 px-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key || 'all'}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
                    activeTab === tab.key
                      ? 'text-orange-500 border-orange-500'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-3">
        {authLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        )}

        {!authLoading && !user && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <User className="w-12 h-12 text-orange-500" />
            <p className="text-gray-600">请登录后查看我的订单</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              去登录
            </button>
          </div>
        )}

        {!authLoading && user && loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        )}

        {!authLoading && user && error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertCircle className="w-12 h-12 mb-3 text-orange-400" />
            <p className="text-sm mb-3">{error}</p>
            <button
              onClick={() => fetchOrders(1, true, activeTab)}
              className="px-4 py-2 text-sm text-orange-500 border border-orange-500 rounded-full hover:bg-orange-50 transition"
            >
              重试
            </button>
          </div>
        )}

        {!authLoading && user && !loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="w-16 h-16 mb-3" />
            <p className="text-sm">暂无订单</p>
            <button
              onClick={() => navigate('/mall')}
              className="mt-4 px-5 py-2 text-sm text-orange-500 border border-orange-500 rounded-full hover:bg-orange-50 transition"
            >
              去逛逛
            </button>
          </div>
        )}

        {!authLoading && user && !loading && !error && orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((order: MallOrderInfo) => {
                const isExpanded = expandedId === order.id;
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl shadow-sm overflow-hidden"
                  >
                    {/* 顶部状态 */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                      <span className="text-xs text-gray-400">
                        订单号：{order.orderNo}
                      </span>
                      <div className="flex items-center gap-2">
                        {order.status === MALL_ORDER_STATUS.PENDING_REVIEW && order.autoConfirmDeadline && (
                          <span className="text-xs text-orange-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-pulse" />
                            {formatCountdown(order.autoConfirmDeadline)}
                          </span>
                        )}
                        {order.status === MALL_ORDER_STATUS.PENDING_DELIVERY && order.autoDeliveryDeadline && (
                          <span className="text-xs text-blue-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-pulse" />
                            {formatCountdown(order.autoDeliveryDeadline).replace('自动确认', '自动收货')}
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            statusColor[order.status] ||
                            'text-gray-500 bg-gray-100'
                          }`}
                        >
                          {MALL_ORDER_STATUS_NAMES[order.status] || order.status}
                        </span>
                      </div>
                    </div>

                    {/* 商品信息 */}
                    <div
                      onClick={() => toggleExpand(order.id)}
                      className="p-4 cursor-pointer hover:bg-gray-50/50 transition"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {order.productImage ? (
                            <Image
                              src={order.productImage}
                              alt={order.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                            {order.productName}
                          </h3>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-orange-500 font-bold text-sm">
                              ¥{order.price}
                            </span>
                            <span className="text-xs text-gray-400">
                              × {order.quantity}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 金额汇总 */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                        <span className="text-xs text-gray-400">
                          {new Date(order.createdAt).toLocaleString('zh-CN')}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">
                            共 {order.quantity} 件，合计
                          </span>
                          <span className="text-sm font-bold text-orange-500">
                            ¥{order.totalAmount}
                          </span>
                        </div>
                      </div>

                      {/* 展开图标 */}
                      <div className="flex justify-center mt-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-gray-50 bg-gray-50/50">
                        <div className="pt-3 space-y-1.5">
                          <div className="flex items-start gap-2 text-xs">
                            <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-600">
                              {order.receiveName || '-'}
                              <span className="text-gray-400 ml-2">
                                {order.receivePhone || ''}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-600">
                              {order.receiveAddress || '-'}
                            </span>
                          </div>
                          {order.logisticsCompany && (
                            <div className="flex items-start gap-2 text-xs">
                              <PackageCheck className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-600">
                                {order.logisticsCompany}：
                                {order.logisticsNo || '-'}
                              </span>
                            </div>
                          )}
                          {order.paymentConfirmedAt && (
                            <div className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-600">
                                付款时间：
                                {new Date(
                                  order.paymentConfirmedAt,
                                ).toLocaleString('zh-CN')}
                              </span>
                            </div>
                          )}
                          {order.deliveredAt && (
                            <div className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-600">
                                完成时间：
                                {new Date(order.deliveredAt).toLocaleString(
                                  'zh-CN',
                                )}
                              </span>
                            </div>
                          )}
                          {order.cancelReason && (
                            <div className="flex items-start gap-2 text-xs">
                              <XCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-600">
                                取消原因：{order.cancelReason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-50">
                      {order.status === MALL_ORDER_STATUS.PENDING_PAYMENT && (
                        <button
                          onClick={() => handlePay(order.id)}
                          className="px-4 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-full hover:bg-orange-600 transition"
                        >
                          去付款
                        </button>
                      )}
                      {order.status === MALL_ORDER_STATUS.PENDING_DELIVERY && (
                        <button
                          onClick={() => handleConfirmDelivery(order.id)}
                          disabled={confirmingId === order.id}
                          className="px-4 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-full hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-1"
                        >
                          {confirmingId === order.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              确认中
                            </>
                          ) : (
                            '确认收货'
                          )}
                        </button>
                      )}
                      {order.status === MALL_ORDER_STATUS.COMPLETED && (
                        <button
                          onClick={() => handleBuyAgain(order.productId)}
                          className="px-4 py-1.5 border border-orange-500 text-orange-500 text-xs font-medium rounded-full hover:bg-orange-50 transition"
                        >
                          再次购买
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 加载更多 */}
            {hasMore && (
              <div className="flex justify-center mt-6 mb-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-2.5 bg-white border border-orange-200 text-orange-500 rounded-full text-sm font-medium hover:bg-orange-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    '加载更多'
                  )}
                </button>
              </div>
            )}

            {!hasMore && orders.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-6 mb-4">
                — 已经到底啦 —
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
