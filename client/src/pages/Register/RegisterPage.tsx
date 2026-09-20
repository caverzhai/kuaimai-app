import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Phone,
  Lock,
  User,
  UserPlus,
  Gift,
  AlertCircle,
  Check,
  QrCode,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@client/src/contexts/AuthContext';
import { APP_VERSION } from '@client/src/utils/version';
import { Html5Qrcode } from 'html5-qrcode';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasInviteCode, setHasInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Auto-fill invite code from URL params
  useEffect(() => {
    const codeFromUrl = searchParams.get('inviteCode');
    if (codeFromUrl) {
      setInviteCode(codeFromUrl);
      setHasInviteCode(true);
    }
  }, [searchParams]);

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
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // 扫描成功
          let code = decodedText;
          if (code.includes('inviteCode=')) {
            const match = code.match(/inviteCode=([^&]+)/);
            if (match) code = match[1];
          }
          setInviteCode(code.toUpperCase());
          setHasInviteCode(true);
          stopScanner();
        },
        () => {
          // 扫描失败回调，忽略
        }
      );
    } catch (err) {
      logger.error('启动摄像头失败', err);
      setError('无法启动摄像头，请手动输入邀请码');
      setShowScanner(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('请输入手机号');
      return;
    }
    if (!nickname.trim()) {
      setError('请输入昵称');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await register({
        phone,
        nickname,
        password,
        inviteCode: hasInviteCode ? inviteCode : undefined,
      });
      navigate('/');
    } catch (err: unknown) {
      logger.error('注册失败', err);
      let msg = '注册失败，请稍后重试';
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>;
        if (e.message) msg = String(e.message);
        else if (e.response?.data?.message) msg = String(e.response.data.message);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl text-white font-bold text-2xl shadow-lg mb-4">
            快
          </div>
          <h1 className="text-2xl font-bold text-gray-900">创建账号</h1>
          <p className="mt-2 text-sm text-gray-500">加入快卖，开启神秘创收之旅</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                手机号
              </label>
              <div className="relative">
                <Phone
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="请输入11位手机号"
                  maxLength={11}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                昵称
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="请输入昵称"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                密码
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6位密码"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                确认密码
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setHasInviteCode(!hasInviteCode)}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
              >
                {hasInviteCode ? (
                  <>
                    <Check size={16} />
                    有邀请码（点击取消）
                  </>
                ) : (
                  <>
                    <Gift size={16} />
                    有邀请码？点击填写
                  </>
                )}
              </button>
            </div>

            {hasInviteCode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  邀请码
                </label>
                <div className="relative">
                  <Gift
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="请输入邀请码"
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
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            已有账号？
            <Link
              to="/login"
              className="text-orange-600 hover:text-orange-700 font-medium ml-1"
            >
              立即登录
            </Link>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400">
            版本 v{APP_VERSION}
          </div>
        </div>
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
            <div id="qr-reader" className="w-full rounded-xl overflow-hidden" />
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

export default RegisterPage;
