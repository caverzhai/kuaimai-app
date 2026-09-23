import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ChevronLeft, Loader2, Upload, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getSellerManagementFees, payManagementFee, getPlatformQrcode } from '@client/src/api';

export default function SellerFeesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<any[]>([]);
  const [payingFee, setPayingFee] = useState<any>(null);
  const [mallQrcode, setMallQrcode] = useState<any>(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const loadFees = async () => {
    setLoading(true);
    try {
      const data = await getSellerManagementFees({ page: 1, pageSize: 50 });
      setFees(data.items || []);
    } catch (e) {
      toast.error('加载推广费失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFees(); }, []);

  const openPay = async (fee: any) => {
    setPayingFee(fee);
    setScreenshotUrl('');
    setQrError(false);
    setMallQrcode(null);
    try {
      const qr = await getPlatformQrcode('mall_platform');
      setMallQrcode(qr);
    } catch (e) {
      setQrError(true);
      toast.error('加载平台收款码失败，请重试');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload/image', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          setScreenshotUrl(data.url);
          toast.success('凭证上传成功');
        } else {
          setScreenshotUrl(base64);
        }
      } catch (err) {
        setScreenshotUrl(base64);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitPay = async () => {
    if (!screenshotUrl) { toast.error('请先上传支付凭证'); return; }
    setSubmitting(true);
    try {
      await payManagementFee(payingFee.id, screenshotUrl);
      toast.success('凭证已提交，等待管理员审核');
      setPayingFee(null);
      loadFees();
    } catch (e) {
      toast.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingAmount = fees.filter(f => f.status === 'pending').reduce((s, f) => s + Number(f.feeAmount), 0);
  const totalSales = fees.reduce((s, f) => s + Number(f.totalSales), 0);

  const statusBadge = (status: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      pending: { text: '待支付', cls: 'bg-yellow-100 text-yellow-700' },
      pending_review: { text: '待审核', cls: 'bg-blue-100 text-blue-700' },
      confirmed: { text: '已确认', cls: 'bg-green-100 text-green-700' },
      overdue: { text: '已逾期', cls: 'bg-red-100 text-red-700' },
    };
    const s = map[status] || { text: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.text}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* 顶部导航 */}
      <div className="bg-white sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">推广费管理</h1>
      </div>

      {/* 统计卡片 */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">累计成交额</div>
          <div className="text-xl font-bold text-gray-900">¥{totalSales.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">待支付推广费</div>
          <div className="text-xl font-bold text-orange-600">¥{pendingAmount.toFixed(2)}</div>
        </div>
      </div>

      {/* 说明 */}
      <div className="px-4 mb-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 leading-relaxed">
          <p className="font-medium mb-1">推广费规则</p>
          <p>• 每日零点自动生成昨日成交额的 8% 作为推广费</p>
          <p>• 请在当日 12:00 前完成支付并上传凭证</p>
          <p>• 逾期未支付，商品将自动下架（仓库状态）</p>
          <p>• 支付至平台收款码，管理员审核确认后完成</p>
        </div>
      </div>

      {/* 列表 */}
      <div className="px-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : fees.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">暂无推广费记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fees.map((fee) => (
              <div key={fee.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{fee.feeDate?.slice(0, 10)} 推广费</span>
                    {statusBadge(fee.status)}
                  </div>
                  <span className="text-lg font-bold text-orange-600">¥{Number(fee.feeAmount).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
                  <span>昨日成交额：¥{Number(fee.totalSales).toFixed(2)}</span>
                  {fee.deadline && <span>支付截止：{new Date(fee.deadline).toLocaleString('zh-CN')}</span>}
                </div>
                {fee.status === 'pending' && (
                  <button
                    onClick={() => openPay(fee)}
                    className="w-full h-10 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 active:opacity-90 flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" /> 立即支付
                  </button>
                )}
                {fee.status === 'pending_review' && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                    <Clock className="w-4 h-4" /> 凭证已提交，等待管理员审核确认
                  </div>
                )}
                {fee.status === 'confirmed' && (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle className="w-4 h-4" /> 管理员已确认到账
                  </div>
                )}
                {fee.status === 'overdue' && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4" /> 已逾期，商品已自动下架，请联系管理员
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 支付弹窗 */}
      {payingFee && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60" onClick={() => !submitting && setPayingFee(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">支付推广费</h3>
              <button onClick={() => !submitting && setPayingFee(null)} className="text-gray-400 text-2xl leading-none">&times;</button>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 mb-4 text-center">
              <div className="text-xs text-gray-500">应付金额</div>
              <div className="text-3xl font-bold text-orange-600 my-1">¥{Number(payingFee.feeAmount).toFixed(2)}</div>
              <div className="text-xs text-gray-500">费期：{payingFee.feeDate?.slice(0, 10)} · 成交额 ¥{Number(payingFee.totalSales).toFixed(2)}</div>
            </div>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-700 mb-2 font-medium">请扫描下方平台收款码支付</p>
              {mallQrcode?.wechatQrcodeUrl ? (
                <img src={mallQrcode.wechatQrcodeUrl} alt="平台收款码" className="w-48 h-auto max-h-72 mx-auto rounded-xl border border-gray-200 object-contain bg-white" />
              ) : qrError ? (
                <div className="w-48 mx-auto rounded-xl border border-red-200 bg-red-50 py-6 flex flex-col items-center justify-center">
                  <p className="text-red-500 text-sm mb-2">收款码加载失败</p>
                  <button onClick={() => openPay(payingFee)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg">点击重试</button>
                </div>
              ) : (
                <div className="w-48 h-48 mx-auto rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 text-sm">收款码加载中...</div>
              )}
              <p className="text-xs text-gray-400 mt-2">支付时请备注：推广费 {payingFee.feeDate?.slice(0, 10)}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">上传支付凭证截图</label>
              <div className="flex items-center gap-3">
                <label className="flex-1 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-orange-400 hover:text-orange-500 transition">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6 mb-1" />}
                  <span className="text-xs">{screenshotUrl ? '重新上传' : '点击上传凭证'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {screenshotUrl && (
                  <img src={screenshotUrl} alt="凭证预览" className="w-24 h-24 object-cover rounded-xl border" />
                )}
              </div>
            </div>
            <button
              onClick={submitPay}
              disabled={submitting || !screenshotUrl}
              className="w-full h-12 bg-orange-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {submitting ? '提交中...' : '提交支付凭证'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
