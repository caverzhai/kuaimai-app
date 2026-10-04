import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Lock, LogIn, AlertCircle } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@client/src/contexts/AuthContext';
import { APP_VERSION } from '@client/src/utils/version';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('请输入手机号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    setLoading(true);
    try {
      await login(phone, password);
      navigate('/');
    } catch (err: unknown) {
      logger.error('登录失败', err);
      const anyErr = err as any;
      // 仅当请求未到达服务器（无响应）才算网络问题；
      // 服务器有响应但未放行，读后端返回的具体 message
      if (!anyErr?.response) {
        setError('网络连接失败：请检查手机是否联网（可切换 Wi-Fi/流量）；确认网络正常后仍无法登录，请联系您的咨询师找管理员重置');
      } else {
        // 后端错误格式 {error:{message:"..."}}
        const apiMsg = anyErr?.response?.data?.error?.message || anyErr?.response?.data?.message;
        if (apiMsg && typeof apiMsg === 'string') {
          setError(apiMsg);
        } else {
          setError('请确认手机号和密码无误；若仍无法登录，可能是系统检测到您的密码有安全问题，请联系您的咨询师找管理员重置');
        }
      }
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
          <h1 className="text-2xl font-bold text-gray-900">欢迎回来</h1>
          <p className="mt-2 text-sm text-gray-500">登录你的AI快卖账号</p>
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
                  inputMode="tel"
                  autoComplete="tel"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
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
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end -mt-2">
              <Link
                to="/forgot"
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                忘记密码？
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            没有账号？
            <Link
              to="/register"
              className="text-orange-600 hover:text-orange-700 font-medium ml-1"
            >
              立即注册
            </Link>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400">
            Powered by WebShark Tech | www.webshark.tech<br/>版本 v{APP_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
