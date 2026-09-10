import { useState, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getFinanceInfo as apiGetFinanceInfo } from '../../api';
import type { UserInfo } from '@shared/api.interface';
import { LEVEL_NAMES, LEVEL_LAYERS } from '@shared/api.interface';
import {
  Wallet,
  Clock,
  TrendingDown,
  Users,
  QrCode,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  Edit,
  Building,
} from 'lucide-react';
import { Image } from '@client/src/components/ui/image';

interface FinanceInfoData {
  totalConsultIncome: string;
  pendingReclaimAmount: string;
  overflowLossAmount: string;
  directInviteCount: number;
  thresholdBlocked: boolean;
  thresholdTriggeredAt?: string;
}

export default function FinancePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<FinanceInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
  }, [authLoading, user]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetFinanceInfo();
      setData(result as FinanceInfoData);
    } catch (err) {
      logger.error('获取资金信息失败', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  const isLevel4Plus = user && LEVEL_LAYERS[user.level] >= 4;
  const isLevel7Plus = user && LEVEL_LAYERS[user.level] >= 7;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Wallet className="h-10 w-10 text-orange-500" />
        <p className="text-gray-600">请登录后查看资金管理</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          去登录
        </button>
      </div>
    );
  }

  if (loading && !error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-destructive">{error}</div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    );
  }

  const stats = [
    {
      label: '累计咨询收入',
      value: `¥${data?.totalConsultIncome || '0'}`,
      icon: Wallet,
      color: 'text-green-500',
      bg: 'bg-green-50',
    },
    {
      label: '待收回金额',
      value: `¥${data?.pendingReclaimAmount || '0'}`,
      icon: Clock,
      color: isLevel4Plus && data?.thresholdBlocked
        ? 'text-red-500'
        : 'text-orange-500',
      bg: isLevel4Plus && data?.thresholdBlocked
        ? 'bg-red-50'
        : 'bg-orange-50',
      highlight: isLevel4Plus && data?.thresholdBlocked,
    },
    {
      label: '超层流失金额',
      value: `¥${data?.overflowLossAmount || '0'}`,
      icon: TrendingDown,
      color: 'text-gray-500',
      bg: 'bg-gray-50',
    },
    {
      label: '直推人数',
      value: `${data?.directInviteCount || 0}人`,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`bg-white rounded-2xl p-4 shadow-sm border ${
              stat.highlight
                ? 'border-red-200 ring-2 ring-red-100'
                : 'border-gray-100'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-2`}
            >
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div
              className={`text-xl font-bold ${
                stat.highlight ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 900门槛说明区（仅4级咨询师显示） */}
      {isLevel4Plus && (
        <div
          className={`rounded-2xl p-5 border ${
            data?.thresholdBlocked
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-gray-100 shadow-sm'
          }`}
        >
          <h2
            className={`text-base font-semibold flex items-center gap-2 mb-3 ${
              data?.thresholdBlocked ? 'text-red-800' : 'text-gray-900'
            }`}
          >
            <AlertTriangle
              className={`h-5 w-5 ${
                data?.thresholdBlocked ? 'text-red-500' : 'text-orange-500'
              }`}
            />
            900门槛说明
          </h2>

          {data?.thresholdBlocked ? (
            <div className="space-y-3">
              <div className="bg-white/80 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">限制状态</span>
                  <span className="text-red-600 font-medium">
                    已触发限制
                  </span>
                </div>
                {data.thresholdTriggeredAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">触发时间</span>
                    <span className="text-gray-900">
                      {new Date(data.thresholdTriggeredAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">待收回金额</span>
                  <span className="text-red-600 font-semibold">
                    ¥{data.pendingReclaimAmount}
                  </span>
                </div>
              </div>

              <div className="text-xs text-red-700 space-y-1.5">
                <div className="font-medium flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" />
                  返还规则说明
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>30天内完成3个直推：100%全额返还</li>
                  <li>60天内完成3个直推：返还50%</li>
                  <li>超过60天未完成：剩余金额归平台所有</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p className="mb-2">
                4级咨询师在直推不足3人时，累计咨询收入超过900元将触发门槛限制。
              </p>
              <p>
                建议尽快完成3个直推，解锁全部收益权限。
                当前直推人数：
                <span className="font-semibold text-orange-500">
                  {data?.directInviteCount || 0}人
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 收款码管理区 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-orange-500" />
            收款码管理
          </h2>
          <button
            onClick={() => navigate('/profile')}
            className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1"
          >
            <Edit className="h-3.5 w-3.5" />
            编辑
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 微信收款码 */}
          <div className="text-center">
            <div className="aspect-square bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center mb-2 overflow-hidden">
              {user.wechatQrcodeUrl ? (
                <Image
                  src={user.wechatQrcodeUrl}
                  alt="微信收款码"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-gray-400 text-xs px-2">
                  未设置微信收款码
                </div>
              )}
            </div>
            <div className="text-sm font-medium text-gray-700">微信收款</div>
          </div>

          {/* 支付宝收款码 */}
          <div className="text-center">
            <div className="aspect-square bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center mb-2 overflow-hidden">
              {user.alipayQrcodeUrl ? (
                <Image
                  src={user.alipayQrcodeUrl}
                  alt="支付宝收款码"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-gray-400 text-xs px-2">
                  未设置支付宝收款码
                </div>
              )}
            </div>
            <div className="text-sm font-medium text-gray-700">支付宝收款</div>
          </div>

          {/* 7级以上显示公司收款码 */}
          {isLevel7Plus && (
            <div className="text-center col-span-2 max-w-[50%] mx-auto">
              <div className="aspect-square bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center mb-2 overflow-hidden">
                {user.companyQrcodeUrl ? (
                  <Image
                    src={user.companyQrcodeUrl}
                    alt="公司收款码"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="text-gray-400 text-xs px-2">
                    未设置公司收款码
                  </div>
                )}
              </div>
              <div className="text-sm font-medium text-gray-700 flex items-center justify-center gap-1">
                <Building className="h-4 w-4 text-orange-500" />
                公司收款
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          咨询服务收款将直接转入您的收款账户
        </p>
      </div>

      {/* 超层流失说明区 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <TrendingDown className="h-5 w-5 text-gray-500" />
          超层流失说明
        </h2>

        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">累计超层流失金额</span>
            <span className="text-lg font-bold text-gray-700">
              ¥{data?.overflowLossAmount || '0'}
            </span>
          </div>

          <div className="text-xs text-gray-500 space-y-1.5 border-t border-gray-200 pt-3">
            <div className="font-medium text-gray-600 flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              超层规则说明
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>
                每个等级对应固定的团队层级深度，超过该层级的订单收益将发生超层流失
              </li>
              <li>
                {LEVEL_NAMES['level_4']}：可享受4层内团队收益
              </li>
              <li>
                {LEVEL_NAMES['level_5']}：可享受5层内团队收益
              </li>
              <li>
                {LEVEL_NAMES['level_6']}：可享受6层内团队收益
              </li>
              <li>
                {LEVEL_NAMES['level_7']} 及以上：不受层级限制
              </li>
            </ul>
            <p className="pt-1 text-orange-600">
              升级到更高等级可以扩大团队层级，减少超层流失。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
