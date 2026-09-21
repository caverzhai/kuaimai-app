import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Lock, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import axiosForBackend from '@client/src/lib/lark-shim';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=输入手机号, 2=回答安全问题, 3=成功

  // 第一步：获取安全问题
  const handleGetQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('请输入手机号');
      return;
    }
    setLoading(true);
    try {
      const resp = await axiosForBackend({
        url: '/api/auth/get-security-question',
        method: 'POST',
        data: { phone },
      });
      if (resp.data.question) {
        setQuestion(resp.data.question);
        setStep(2);
      } else {
        setError('该账号未设置安全问题，请联系管理员重置密码');
      }
    } catch (err: unknown) {
      logger.error('获取安全问题失败', err);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || '获取安全问题失败'
          : '获取安全问题失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 第二步：重置密码
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!securityAnswer.trim()) {
      setError('请输入安全问题答案');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('新密码长度至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await axiosForBackend({
        url: '/api/auth/reset-password-by-security',
        method: 'POST',
        data: { phone, securityAnswer, newPassword },
      });
      setStep(3);
      setSuccess(true);
    } catch (err: unknown) {
      logger.error('重置密码失败', err);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || '重置密码失败'
          : '重置密码失败';
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
          <h1 className="text-2xl font-bold text-gray-900">找回密码</h1>
          <p className="mt-2 text-sm text-gray-500">通过安全问题重置你的密码</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleGetQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  手机号
                </label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl shadow-sm transition-colors"
              >
                {loading ? '查询中...' : '下一步'}
              </button>
            </form>
          )}

          {step === 2 && question && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-4 bg-orange-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle size={18} className="text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">安全问题</span>
                </div>
                <p className="text-base text-gray-900">{question}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  安全问题答案
                </label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="请输入你注册时设置的答案"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  新密码
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少6位新密码"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  确认新密码
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl shadow-sm transition-colors"
              >
                {loading ? '重置中...' : '重置密码'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setQuestion(null); setError(''); }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                返回上一步
              </button>
            </form>
          )}

          {step === 3 && success && (
            <div className="text-center py-8">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">密码重置成功</h3>
              <p className="text-sm text-gray-500 mb-6">你的密码已成功重置，请使用新密码登录</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl shadow-sm transition-colors"
              >
                去登录
              </button>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            想起密码了？
            <Link to="/login" className="text-orange-600 hover:text-orange-700 font-medium ml-1">
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
