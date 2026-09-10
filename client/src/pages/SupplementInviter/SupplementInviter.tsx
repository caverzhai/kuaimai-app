import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Lock,
  ArrowRight,
  QrCode,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@client/src/contexts/AuthContext';
import { supplementInviter } from '@client/src/api';
import { Html5Qrcode } from 'html5-qrcode';

const SupplementInviterPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!inviteCode.trim()) {
      setError('请输入邀请码');
      return;
    }
    setLoading(true);
    try {
      await supplementInviter(inviteCode.trim());
      await refreshUser();
      setSuccess(true);
    } catch (err: unknown) {
      logger.error('补充邀请人失败', err);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || '补充邀请人失败，请稍后重试'
          : '补充邀请人失败，请稍后重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 扫码功能：扫描邀请二维码自动填写邀请码
  const handleScanInviteCode = () => {
    setShowScanner(true);
    setError('');
    // 弹窗显示后自动启动摄像头
    setTimeout(() => {
      startScanner();
    }, 300);
  };

  // 启动摄像头扫码
  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode('qr-reader-supplement');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // 扫描成功，提取邀请码
          let code = decodedText.trim();
          // 如果是URL，提取最后的邀请码参数
          if (code.includes('invite=') || code.includes('inviteCode=')) {
            const url = new URL(code);
            code = url.searchParams.get('invite') || url.searchParams.get('inviteCode') || code;
          } else if (code.includes('/register?')) {
            try {
              const url = new URL(code);
              code = url.searchParams.get('invite') || url.searchParams.get('inviteCode') || code;
            } catch {}
          }
          setInviteCode(code);
          stopScanner();
        },
        () => {
          // 扫描失败，忽略
        }
      );
    } catch (err) {
      logger.error('启动摄像头失败', err);
      setError('启动摄像头失败，请检查摄像头权限');
    }
  };

  // 停止扫码
  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current?.clear();
        scannerRef.current = null;
      }).catch(() => {});
    }
    setShowScanner(false);
  };

  // 组件卸载时停止扫码
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  if (user?.isInvited && !success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">您已是被邀请用户</h1>
          <p className="mt-2 text-sm text-gray-500">
            您已拥有邀请人，无需再次补充
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
          >
            返回首页 <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">补充成功</h1>
          <p className="mt-2 text-sm text-gray-500">
            您已成功绑定邀请人，全部功能已解锁
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
            >
              前往任务中心 <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg mb-4">
          <Gift size={28} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">补充邀请人</h1>
        <p className="mt-2 text-sm text-gray-500">
          填写邀请码，解锁全部功能
        </p>
      </div>

      <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Lock size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-orange-800">补充邀请人后可解锁</p>
            <ul className="mt-2 space-y-1 text-orange-700 text-xs">
              <li>· 完整的7级分销体系收益</li>
              <li>· 咨询师服务与咨询接单权限</li>
              <li>· 团队管理与邀请功能</li>
              <li>· 任务中心全部任务</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
            <AlertCircle
              size={18}
              className="text-red-500 flex-shrink-0 mt-0.5"
            />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              邀请码
            </label>
            <div className="relative">
              <UserPlus
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="请输入邀请人的邀请码"
                className="w-full pl-10 pr-20 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={handleScanInviteCode}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium"
                title="扫码输入邀请码"
              >
                <QrCode size={16} />
                <span>扫码</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2"
          >
            <Gift size={18} />
            {loading ? '提交中...' : '提交邀请码'}
          </button>
        </form>
      </div>

      {/* 扫码弹窗 */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">扫描邀请二维码</h3>
              <button
                onClick={stopScanner}
                className="text-white hover:text-gray-300 p-2"
              >
                ✕
              </button>
            </div>
            <div id="qr-reader-supplement" className="w-full rounded-xl overflow-hidden" />
            <p className="text-gray-400 text-sm text-center mt-4">
              将邀请二维码放入框内即可自动识别
            </p>
            <button
              onClick={startScanner}
              className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl"
            >
              重新扫码
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplementInviterPage;
