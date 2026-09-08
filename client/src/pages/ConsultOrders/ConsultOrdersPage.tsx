import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Upload,
  CheckCircle2,
  FileText,
  ClipboardCheck,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyConsultOrders,
  uploadConsultPayment,
  confirmConsultPayment,
} from '../../api';
import { uploadImageToServer } from '../../utils/imageUpload';
import type { ConsultOrderInfo, ConsultOrderListResponse } from '@shared/api.interface';
import { CONSULT_ORDER_STATUS, CONSULT_ORDER_STATUS_NAMES } from '@shared/api.interface';

type ViewMode = 'student' | 'consultant';

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: CONSULT_ORDER_STATUS.PENDING_PAYMENT, label: '待付款' },
  { value: CONSULT_ORDER_STATUS.PENDING_CONFIRM, label: '待确认' },
  { value: CONSULT_ORDER_STATUS.IN_SERVICE, label: '服务中' },
  { value: CONSULT_ORDER_STATUS.PENDING_REVIEW, label: '待审核' },
  { value: CONSULT_ORDER_STATUS.COMPLETED, label: '已完成' },
];

function getStatusColorClass(status: string): string {
  switch (status) {
    case CONSULT_ORDER_STATUS.PENDING_PAYMENT:
      return 'text-orange-600 bg-orange-50';
    case CONSULT_ORDER_STATUS.PENDING_CONFIRM:
      return 'text-blue-600 bg-blue-50';
    case CONSULT_ORDER_STATUS.IN_SERVICE:
      return 'text-purple-600 bg-purple-50';
    case CONSULT_ORDER_STATUS.PENDING_REVIEW:
      return 'text-amber-600 bg-amber-50';
    case CONSULT_ORDER_STATUS.COMPLETED:
      return 'text-green-600 bg-green-50';
    case CONSULT_ORDER_STATUS.CANCELLED:
      return 'text-gray-500 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

const SERVICE_TYPE_NAMES: Record<string, string> = {
  upgrade_task: '升级任务服务',
  general_consult: '一般咨询服务',
};

interface OrderCardProps {
  order: ConsultOrderInfo;
  mode: ViewMode;
  onPay: (order: ConsultOrderInfo) => void;
  onConfirm: (order: ConsultOrderInfo) => void;
}

function OrderCard({ order, mode, onPay, onConfirm }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const otherParty = mode === 'student' ? order.consultant : order.student;

  const showPayButton = mode === 'student' && order.status === CONSULT_ORDER_STATUS.PENDING_PAYMENT;
  const showConfirmButton = mode === 'consultant' && order.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      data-ai-section-type="card-list"
    >
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <Image
            src={otherParty?.avatarUrl || ''}
            alt={otherParty?.nickname || ''}
            width={44}
            height={44}
            className="w-11 h-11 rounded-full object-cover bg-gray-100 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-900 truncate">
                {otherParty?.nickname || '未知用户'}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getStatusColorClass(order.status)}`}
              >
                {CONSULT_ORDER_STATUS_NAMES[order.status]}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-gray-500 truncate">
                {SERVICE_TYPE_NAMES[order.serviceType] || order.serviceType}
              </span>
              <span className="text-base font-bold text-orange-600">
                ¥{order.amount}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 font-mono truncate">
              订单号：{order.orderNo}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        {(showPayButton || showConfirmButton) && (
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-50" onClick={(e) => e.stopPropagation()}>
            {showPayButton && (
              <Button
                size="sm"
                onClick={() => onPay(order)}
                className="bg-orange-500 hover:bg-orange-600 text-white h-8"
              >
                去付款
              </Button>
            )}
            {showConfirmButton && (
              <Button
                size="sm"
                onClick={() => onConfirm(order)}
                className="bg-green-500 hover:bg-green-600 text-white h-8"
              >
                确认收款
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-center mt-2">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
          <div className="pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">服务类型</span>
              <span className="text-gray-900">
                {SERVICE_TYPE_NAMES[order.serviceType] || order.serviceType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">订单金额</span>
              <span className="text-gray-900 font-medium">¥{order.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">订单号</span>
              <span className="text-gray-900 font-mono text-xs">{order.orderNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">创建时间</span>
              <span className="text-gray-900">
                {new Date(order.createdAt).toLocaleString()}
              </span>
            </div>
            {order.paymentConfirmedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">收款确认时间</span>
                <span className="text-gray-900">
                  {new Date(order.paymentConfirmedAt).toLocaleString()}
                </span>
              </div>
            )}
            {order.workSubmittedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">作业提交时间</span>
                <span className="text-gray-900">
                  {new Date(order.workSubmittedAt).toLocaleString()}
                </span>
              </div>
            )}
            {order.workReviewedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">作业审核时间</span>
                <span className="text-gray-900">
                  {new Date(order.workReviewedAt).toLocaleString()}
                </span>
              </div>
            )}
            {order.paymentScreenshotUrl && (
              <div className="pt-2">
                <span className="text-gray-500 text-sm">付款截图</span>
                <Image
                  src={order.paymentScreenshotUrl}
                  alt="付款截图"
                  width={120}
                  height={120}
                  className="mt-1.5 w-32 h-32 rounded-lg object-cover bg-gray-100"
                />
              </div>
            )}
            {order.workScreenshotUrl && (
              <div className="pt-2">
                <span className="text-gray-500 text-sm">作业截图</span>
                <Image
                  src={order.workScreenshotUrl}
                  alt="作业截图"
                  width={120}
                  height={120}
                  className="mt-1.5 w-32 h-32 rounded-lg object-cover bg-gray-100"
                />
              </div>
            )}
            {order.reviewRemark && (
              <div className="pt-2">
                <span className="text-gray-500 text-sm">审核备注</span>
                <p className="mt-1 text-gray-900">{order.reviewRemark}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsultOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<ViewMode>('student');
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState<ConsultOrderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 付款相关
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<ConsultOrderInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        role: mode,
        page: 1,
        pageSize: 50,
      };
      if (status) params.status = status;
      const data = (await getMyConsultOrders(params)) as ConsultOrderListResponse;
      setOrders(data.items);
    } catch (err) {
      setError('加载订单列表失败，请稍后重试');
      logger.error('加载咨询订单失败', err);
    } finally {
      setLoading(false);
    }
  }, [mode, status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handlePay = (order: ConsultOrderInfo) => {
    setCurrentOrder(order);
    setUploaded(false);
    setDialogError(null);
    setPayDialogOpen(true);
  };

  const handleConfirm = async (order: ConsultOrderInfo) => {
    try {
      await confirmConsultPayment(order.id);
      toast('确认收款成功，订单已完成');
      await fetchOrders();
    } catch (err) {
      logger.error('确认收款失败', err);
      toast('确认收款失败，请稍后重试');
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrder) return;
    setUploading(true);
    setDialogError(null);
    try {
      // 先上传图片到服务器，获取真实URL
      const imageUrl = await uploadImageToServer(file);
      await uploadConsultPayment(currentOrder.id, imageUrl);
      setUploaded(true);
      fetchOrders();
    } catch (err) {
      setDialogError('上传失败，请稍后重试');
      logger.error('上传失败', err);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">咨询订单</h1>

      {/* 视角切换 */}
      <div className="bg-gray-100 rounded-xl p-1 flex mb-4">
        <button
          onClick={() => setMode('student')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'student'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          我购买的
        </button>
        <button
          onClick={() => setMode('consultant')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'consultant'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          我收到的
        </button>
      </div>

      {/* 状态 tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-hide">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              status === tab.value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : error && orders.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>{error}</p>
          <Button variant="outline" onClick={fetchOrders} className="mt-4">
            重新加载
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>暂无订单</p>
          <Button
            variant="outline"
            onClick={() => navigate('/consultants')}
            className="mt-4"
          >
            去找咨询师
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mode={mode}
              onPay={handlePay}
              onConfirm={handleConfirm}
            />
          ))}
        </div>
      )}

      {/* 付款/上传作业通用对话框 */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上传付款截图</DialogTitle>
          </DialogHeader>
          {currentOrder && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">订单号</span>
                  <span className="font-mono font-medium text-gray-900">
                    {currentOrder.orderNo}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">金额</span>
                  <span className="text-lg font-bold text-orange-600">
                    ¥{currentOrder.amount}
                  </span>
                </div>
              </div>

              {!uploaded ? (
                <>
                  {dialogError && (
                    <p className="text-sm text-red-500 text-center">
                      {dialogError}
                    </p>
                  )}
                  <Button
                    onClick={() =>
                      document.getElementById('consult-order-file-input')?.click()
                    }
                    disabled={uploading}
                    className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        选择图片上传
                      </>
                    )}
                  </Button>
                  <input
                    id="consult-order-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFile}
                    className="hidden"
                  />
                </>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-900 font-medium">
                    {currentOrder.status === CONSULT_ORDER_STATUS.PENDING_PAYMENT
                      ? '已提交，等待咨询师确认收款'
                      : '作业已提交，等待咨询师审核'}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
