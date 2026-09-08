import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, ArrowLeft, User, Briefcase, FileCheck,
  ListChecks, QrCode, CreditCard, Upload,
  CheckCircle2, Info, ChevronDown,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  getConsultantDetail,
  createConsultOrder,
  uploadConsultPayment,
  getMyConsultOrders,
} from '../../api';
import { uploadImageToServer } from '../../utils/imageUpload';
import type { UserInfo, ConsultOrderInfo } from '@shared/api.interface';
import { LEVEL_NAMES, LEVEL_LAYERS, CONSULT_ORDER_STATUS_NAMES } from '@shared/api.interface';

const SERVICE_TYPES = [
  { value: 'upgrade_task', label: '升级任务服务' },
  { value: 'general_consult', label: '一般咨询服务' },
];

function getLevelColorClass(level: string): string {
  const layer = LEVEL_LAYERS[level];
  switch (layer) {
    case 4:
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 5:
      return 'bg-green-100 text-green-700 border-green-200';
    case 6:
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 7:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 8:
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export default function ConsultantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fixedAmount = searchParams.get('amount');
  const taskId = searchParams.get('taskId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [consultant, setConsultant] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 用户在该咨询师处的待审核订单（防重复购买）
  const [pendingOrder, setPendingOrder] = useState<ConsultOrderInfo | null>(null);

  const [serviceType, setServiceType] = useState('upgrade_task');
  const [amount, setAmount] = useState(fixedAmount || '');

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<ConsultOrderInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      setPendingOrder(null);
      try {
        const [data, ordersResult] = await Promise.all([
          getConsultantDetail(id),
          user ? getMyConsultOrders({
            status: 'pending_confirm,pending_review,in_service',
            pageSize: 50,
          }).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
        ]);
        setConsultant(data as UserInfo);

        // 检查是否已有该咨询师的待审核订单
        const myOrders = (ordersResult as { items: ConsultOrderInfo[] }).items || [];
        const existingPending = myOrders.find((o) => o.consultantId === id);
        if (existingPending) {
          setPendingOrder(existingPending);
          setLoading(false);
          return;
        }

        // 如果有固定金额且没有待审核订单，自动创建订单并打开支付弹窗
        if (fixedAmount) {
          const numAmount = Number(fixedAmount);
          if (numAmount > 0) {
            setCreatingOrder(true);
            try {
              const order = await createConsultOrder({
                consultantId: id,
                serviceType: 'upgrade_task',
                amount: numAmount,
              });
              setCurrentOrder(order as ConsultOrderInfo);
              setPurchaseDialogOpen(true);
            } catch (err) {
              setOrderError('创建订单失败，请稍后重试');
              logger.error('自动创建订单失败', err);
            } finally {
              setCreatingOrder(false);
            }
          }
        }
      } catch (err) {
        setError('加载咨询师详情失败，请稍后重试');
        logger.error('加载咨询师详情失败', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [id, fixedAmount, user]);

  const handleBuy = async () => {
    if (!id || !amount) return;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setOrderError('请输入有效的金额');
      return;
    }
    setCreatingOrder(true);
    setOrderError(null);
    try {
      const data = await createConsultOrder({
        consultantId: id,
        serviceType,
        amount: numAmount,
      });
      setCurrentOrder(data as ConsultOrderInfo);
      setPurchaseDialogOpen(true);
    } catch (err) {
      setOrderError('创建订单失败，请稍后重试');
      logger.error('创建咨询订单失败', err);
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrder) return;
    setUploading(true);
    try {
      // 先上传图片到服务器，获取真实URL
      const imageUrl = await uploadImageToServer(file);
      await uploadConsultPayment(currentOrder.id, imageUrl);
      setUploaded(true);
      // 上传成功后1.5秒自动关闭弹窗并返回任务中心
      setTimeout(() => {
        setPurchaseDialogOpen(false);
        if (taskId) {
          navigate('/tasks');
        } else {
          navigate('/consult-orders');
        }
      }, 1500);
    } catch (err) {
      setOrderError('上传付款截图失败，请稍后重试');
      logger.error('上传付款截图失败', err);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const isCompanyQrcode = consultant && LEVEL_LAYERS[consultant.level] >= 7;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !consultant) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <div className="text-center py-20 text-gray-500">
          <p>{error || '咨询师不存在'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-2 -ml-2 text-gray-600"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回
      </Button>

      {/* 头部信息 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-[72px] h-[72px] shrink-0 overflow-hidden rounded-2xl bg-gray-100">
            <Image
              src={consultant.avatarUrl || ''}
              alt={consultant.nickname}
              width={72}
              height={72}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                {consultant.nickname}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0 h-5 font-medium ${getLevelColorClass(consultant.level)}`}
              >
                {LEVEL_NAMES[consultant.level] || consultant.level}
              </Badge>
            </div>
            {consultant.industry && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
                <Briefcase className="w-4 h-4" />
                <span>{consultant.industry}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 资质 & 服务标准 */}
      <Card className="mb-4 border-gray-100 shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-4">
          {consultant.qualification && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="w-5 h-5 text-orange-500" />
                <h2 className="font-semibold text-gray-900">资质证明</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {consultant.qualification}
              </p>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900">服务标准</h2>
            </div>
            {consultant.serviceStandard ? (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {consultant.serviceStandard}
              </p>
            ) : (
              <p className="text-sm text-gray-400">暂无服务标准说明</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 收款码 */}
      <Card className="mb-4 border-gray-100 shadow-sm rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-900">
              {isCompanyQrcode ? '公司收款码' : '收款码'}
            </h2>
          </div>

          {isCompanyQrcode ? (
            <div className="flex justify-center">
              {consultant.companyQrcodeUrl ? (
                <Image
                  src={consultant.companyQrcodeUrl}
                  alt="公司收款码"
                  width={200}
                  height={200}
                  className="w-48 h-48 rounded-xl object-cover bg-gray-100"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
                  暂无收款码
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">微信收款</p>
                {consultant.wechatQrcodeUrl ? (
                  <Image
                    src={consultant.wechatQrcodeUrl}
                    alt="微信收款码"
                    width={140}
                    height={140}
                    className="w-full aspect-square rounded-xl object-cover bg-gray-100"
                  />
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                    暂无
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">支付宝收款</p>
                {consultant.alipayQrcodeUrl ? (
                  <Image
                    src={consultant.alipayQrcodeUrl}
                    alt="支付宝收款码"
                    width={140}
                    height={140}
                    className="w-full aspect-square rounded-xl object-cover bg-gray-100"
                  />
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                    暂无
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 购买服务区 */}
      <Card className="border-gray-100 shadow-sm rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-900">
              {fixedAmount ? '升级任务服务' : '购买咨询服务'}
            </h2>
          </div>

          <div className="space-y-4">
            {/* 如果已有该咨询师的待审核订单，显示提示，不允许重复购买 */}
            {pendingOrder ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700">
                  您已购买该咨询师的服务，当前待审核
                </p>
                <p className="text-xs text-green-600 mt-1">
                  订单状态：{CONSULT_ORDER_STATUS_NAMES[pendingOrder.status as keyof typeof CONSULT_ORDER_STATUS_NAMES] || pendingOrder.status}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  上级确认收款后订单自动完成，请勿重复购买
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/consult-orders')}
                  className="mt-3"
                >
                  查看我的订单
                </Button>
              </div>
            ) : fixedAmount ? (
              <>
                {/* 固定金额模式：直接显示金额和支付按钮 */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-orange-600 mb-1">升级任务应付金额</p>
                  <p className="text-3xl font-bold text-orange-600">¥{fixedAmount}</p>
                  <p className="text-xs text-orange-500 mt-2">请扫码支付对应金额，然后上传付款截图</p>
                </div>
                {orderError && !purchaseDialogOpen && (
                  <p className="text-sm text-red-500">{orderError}</p>
                )}
                <Button
                  onClick={handleBuy}
                  disabled={creatingOrder}
                  className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-medium"
                >
                  {creatingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      创建订单中...
                    </>
                  ) : (
                    '立即支付'
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* 普通模式：用户自己选择服务类型和金额 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    服务类型
                  </label>
                  <div className="relative">
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      className="w-full h-11 px-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                    >
                      {SERVICE_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    金额（元）
                  </label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="请输入服务金额"
                    className="h-11"
                  />
                </div>

                {orderError && !purchaseDialogOpen && (
                  <p className="text-sm text-red-500">{orderError}</p>
                )}

                <Button
                  onClick={handleBuy}
                  disabled={creatingOrder || !amount || Number(amount) <= 0}
                  className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-medium"
                >
                  {creatingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      创建订单中...
                    </>
                  ) : (
                    '立即购买'
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 购买对话框 */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>订单已创建</DialogTitle>
            <DialogDescription>
              请按照下方信息完成付款
            </DialogDescription>
          </DialogHeader>

          {currentOrder && (
            <div className="space-y-4">
              <div className="bg-orange-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">订单号</span>
                  <span className="font-mono font-medium text-gray-900">
                    {currentOrder.orderNo}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">应付金额</span>
                  <span className="text-xl font-bold text-orange-600">
                    ¥{currentOrder.amount}
                  </span>
                </div>
              </div>

              {/* 咨询师收款码 */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">咨询师收款码</p>
                <div className="flex justify-center">
                  {isCompanyQrcode ? (
                    consultant.companyQrcodeUrl ? (
                      <Image
                        src={consultant.companyQrcodeUrl}
                        alt="收款码"
                        width={160}
                        height={160}
                        className="w-40 h-40 rounded-xl object-cover bg-gray-100"
                      />
                    ) : (
                      <div className="w-40 h-40 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                        暂无收款码
                      </div>
                    )
                  ) : consultant.wechatQrcodeUrl ? (
                    <Image
                      src={consultant.wechatQrcodeUrl}
                      alt="微信收款码"
                      width={160}
                      height={160}
                      className="w-40 h-40 rounded-xl object-cover bg-gray-100"
                    />
                  ) : (
                    <div className="w-40 h-40 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                      暂无收款码
                    </div>
                  )}
                </div>
              </div>

              {/* 提示 */}
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  请备注订单号转账，20分钟内未确认将自动确认收款
                </p>
              </div>

              {!uploaded ? (
                <>
                  {orderError && (
                    <p className="text-sm text-red-500 text-center">
                      {orderError}
                    </p>
                  )}
                  <Button
                    onClick={handleUploadClick}
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
                        上传付款截图
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </>
              ) : (
                <div className="text-center py-2">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-900 font-medium">
                    已提交，等待咨询师确认收款
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    订单状态：{CONSULT_ORDER_STATUS_NAMES[currentOrder.status]}
                  </p>
                </div>
              )}

              {uploaded && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPurchaseDialogOpen(false);
                    navigate('/consult-orders');
                  }}
                  className="w-full"
                >
                  查看我的订单
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
