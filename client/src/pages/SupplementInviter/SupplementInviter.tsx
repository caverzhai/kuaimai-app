import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@client/src/contexts/AuthContext';
import { supplementInviter } from '@client/src/api';

const SupplementInviterPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors text-sm"
              />
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
    </div>
  );
};

export default SupplementInviterPage;
