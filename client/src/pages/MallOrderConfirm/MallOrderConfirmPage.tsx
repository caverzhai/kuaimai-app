import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  Minus,
  Plus,
  MapPin,
  User,
  Phone,
  Upload,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Package,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '../../contexts/AuthContext';
import {
  getProductDetail,
  createMallOrder,
  getPlatformQrcode,
  uploadMallPayment,
} from '../../api';
import { uploadImageToServer } from '../../utils/imageUpload';
import type {
  ProductInfo,
  MallOrderInfo,
  PlatformQrcodeInfo,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

type Step = 'confirm' | 'payment' | 'submitted';
const STEP_TITLES: Record<Step, string> = {
  confirm: '确认订单',
  payment: '订单支付',
  submitted: '提交成功',
};

export default function MallOrderConfirmPage() {
  const { productId } = useParams<{ productId: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(Number(sp.get('quantity')) || 1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addr, setAddr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('confirm');
  const [order, setOrder] = useState<MallOrderInfo | null>(null);
  const [qrcode, setQrcode] = useState<PlatformQrcodeInfo | null>(null);
  const [qrTab, setQrTab] = useState<'wechat' | 'alipay'>('wechat');
  const [uploading, setUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setProduct((await getProductDetail(productId)) as ProductInfo);
      } catch (e) {
        logger.error('获取商品详情失败', e);
        setError('加载商品失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  useEffect(() => {
    if (!user) return;
    // 收货人姓名：优先使用实名认证的真实姓名，否则用昵称
    if (user.realName && !name) setName(user.realName);
    else if (user.nickname && !name) setName(user.nickname);
    // 收货人电话：使用注册手机号
    if (user.phone && !phone) setPhone(user.phone);
    // 收货地址：优先使用实名认证的户籍地址
    if (user.address && !addr) setAddr(user.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleSubmit() {
    if (!name.trim()) return setError('请填写收货人姓名');
    if (!phone.trim()) return setError('请填写收货人手机号');
    if (!addr.trim()) return setError('请填写收货地址');
    if (!productId) return;
    try {
      setSubmitting(true);
      setError(null);
      setOrder(
        (await createMallOrder({
          productId,
          quantity: qty,
          receiveName: name.trim(),
          receivePhone: phone.trim(),
          receiveAddress: addr.trim(),
        })) as MallOrderInfo,
      );
      setQrcode(
        (await getPlatformQrcode('mall_platform')) as PlatformQrcodeInfo,
      );
      setStep('payment');
    } catch (e) {
      logger.error('创建订单失败', e);
      setError('创建订单失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageUploading(true);
    setError(null);
    try {
      // 先上传图片到服务器，获取真实URL
      const url = await uploadImageToServer(f);
      setScreenshotUrl(url);
    } catch (err) {
      logger.error('图片上传失败', err);
      setError('图片上传失败，请稍后重试');
    } finally {
      setImageUploading(false);
      if (e.target) e.target.value = '';
    }
  }

  async function handleUpload() {
    if (!order) return;
    if (!screenshotUrl) return setError('请先选择付款截图');
    try {
      setUploading(true);
      setError(null);
      await uploadMallPayment(order.id, screenshotUrl);
      setStep('submitted');
      // 上传成功后1.5秒自动返回
      setTimeout(() => {
        // 如果是从任务中心来的，返回任务中心；否则返回我的订单
        const fromTask = sp.get('fromTask');
        if (fromTask) {
          navigate('/tasks');
        } else {
          navigate('/my-orders');
        }
      }, 1500);
    } catch (e) {
      logger.error('上传付款截图失败', e);
      setError('上传失败，请稍后重试');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error && !product && step === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 px-4">
        <AlertCircle className="w-12 h-12 mb-3 text-orange-400" />
        <p className="text-sm mb-3">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm text-orange-500 border border-orange-500 rounded-full hover:bg-orange-50 transition"
        >
          返回
        </button>
      </div>
    );
  }

  const totalAmount = product
    ? (Number(product.price) * qty).toFixed(2)
    : '0';

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">
            {STEP_TITLES[step]}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {step === 'confirm' && product && (
          <>
            {/* 商品 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {product.mainImages?.[0]?.url ? (
                    <Image
                      src={product.mainImages[0].url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                    {product.name}
                  </h3>
                  {product.spec && (
                    <p className="text-xs text-gray-400 mt-1">
                      规格：{product.spec}
                    </p>
                  )}
                  <p className="text-orange-500 font-bold mt-2">
                    ¥{product.price}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                <span className="text-sm text-gray-700">数量</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    disabled={qty <= 1}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-medium">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 收货地址 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mt-3">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  收货地址
                </h3>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="收货人姓名"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="收货人手机号"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    placeholder="详细收货地址"
                    rows={2}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 金额 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mt-3">
              <div className="flex justify-between text-sm text-gray-500">
                <span>商品金额</span>
                <span className="text-gray-900">¥{product.price}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mt-2">
                <span>数量</span>
                <span className="text-gray-900">× {qty}</span>
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-sm font-medium text-gray-700">
                  实付金额
                </span>
                <span className="text-xl font-bold text-orange-500">
                  ¥{totalAmount}
                </span>
              </div>
            </div>
          </>
        )}

        {step === 'payment' && order && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                订单信息
              </h3>
              <p className="text-xs text-gray-500">
                订单号：<span className="text-gray-700">{order.orderNo}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                商品：<span className="text-gray-700">{order.productName}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                数量：<span className="text-gray-700">{order.quantity}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                收货人：
                <span className="text-gray-700">
                  {order.receiveName} {order.receivePhone}
                </span>
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 text-center">
                请扫码支付
              </h3>
              <p className="text-center text-3xl font-bold text-orange-500">
                ¥{order.totalAmount}
              </p>
              <div className="flex gap-2 mt-4 mb-4">
                {(['wechat', 'alipay'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setQrTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      qrTab === tab
                        ? tab === 'wechat'
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab === 'wechat' ? '微信支付' : '支付宝'}
                  </button>
                ))}
              </div>
              <div className="flex justify-center">
                {qrTab === 'wechat' && qrcode?.wechatQrcodeUrl ? (
                  <img
                    src={qrcode.wechatQrcodeUrl}
                    alt="微信收款码"
                    className="w-56 h-56 object-cover rounded-xl border-2 border-green-200"
                  />
                ) : qrTab === 'alipay' && qrcode?.alipayQrcodeUrl ? (
                  <img
                    src={qrcode.alipayQrcodeUrl}
                    alt="支付宝收款码"
                    className="w-56 h-56 object-cover rounded-xl border-2 border-blue-200"
                  />
                ) : (
                  <div className="w-56 h-56 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    收款码暂无
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-gray-400 mt-3">
                请备注订单号转账，20分钟内未审核自动确认
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                上传付款截图
              </h3>
              <input
                type="file"
                ref={fileRef}
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
              />
              {screenshotUrl ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="relative w-40 h-40 rounded-lg overflow-hidden border-2 border-dashed border-orange-200 cursor-pointer"
                >
                  <Image
                    src={screenshotUrl}
                    alt="付款截图"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                    点击更换
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-40 h-40 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-orange-300 hover:text-orange-400 transition"
                >
                  <Upload className="w-8 h-8 mb-1" />
                  <span className="text-xs">点击上传截图</span>
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'submitted' && (
          <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              已提交，等待审核
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              您的付款凭证已提交，工作人员将在20分钟内完成审核
              <br />
              审核通过后将为您发货
            </p>
            <button
              onClick={() => navigate('/my-orders')}
              className="w-full max-w-xs py-3 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition"
            >
              查看订单
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 底部按钮 - 在底部导航栏上方显示，避免被遮挡 */}
      {step === 'confirm' && (
        <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0_0_0_0.05)]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500">实付：</span>
              <span className="text-xl font-bold text-orange-500">
                ¥{totalAmount}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-2.5 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-semibold rounded-full disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                '提交订单'
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0_0_0_0.05)]">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <button
              onClick={handleUpload}
              disabled={uploading || imageUploading || !screenshotUrl}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-semibold rounded-full disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading || imageUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {imageUploading ? '图片上传中...' : '提交中...'}
                </>
              ) : (
                '上传付款截图'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
