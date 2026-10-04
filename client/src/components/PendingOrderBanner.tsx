import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { getPendingOrder, type PendingOrder } from '@client/src/utils/pendingOrder';

/**
 * 全局"待支付订单"醒目横幅：用户存在已创建但未付款的订单时显示，
 * 点击直接跳转到对应待付款列表，引导先完成支付、避免重复下单。
 */
export function PendingOrderBanner({ refreshKey }: { refreshKey?: number }) {
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const check = () => getPendingOrder().then((p) => {
      if (alive) setPending(p);
    });
    check();
    // 兜底轮询：支付完成后即使没有路由变化也能自动消失
    const timer = setInterval(check, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [location.pathname, refreshKey]);

  if (!pending) return null;

  const target = pending.kind === 'mall' ? '/my-orders' : '/consult-orders';
  const label = pending.kind === 'mall' ? '我的订单-待付款' : '我的咨询单-待付款';

  return (
    <button
      onClick={() => navigate(target)}
      className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-left active:bg-red-100 transition-colors"
    >
      <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-600">
          您有1笔待支付订单{pending.amount ? `（¥${pending.amount}）` : ''}
        </p>
        <p className="text-xs text-red-500">
          请先到「{label}」完成付款，再继续拍下商品或领取任务
        </p>
      </div>
      <ChevronRight size={18} className="text-red-400 flex-shrink-0" />
    </button>
  );
}
