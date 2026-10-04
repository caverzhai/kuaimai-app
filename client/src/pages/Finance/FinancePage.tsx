import { useState, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImagePreview } from '@/components/ImageLightbox';
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
  Ban,
  RotateCcw,
} from 'lucide-react';
import { Image } from '@client/src/components/ui/image';
import { getErrorMessage } from '../../utils/errorMessage';
import { getIncomeStats, getRecentConsult } from '../../api/stats';

interface FinanceInfoData {
  totalConsultIncome: string;
  pendingReclaimAmount: string;
  overflowLossAmount: string;
  permanentLossAmount: string; // 永久流失（级别不够）
  platformCollectedAmount: string; // 平台累计代收（可返回）
  refundedAmount: string; // 已返还
  assessmentStatus: string; // none/collecting/passed/eliminated
  fourStarAt?: string;
  refundRate?: number;
  refundStatus: string;
  directInviteCount: number;
  thresholdBlocked: boolean;
  thresholdTriggeredAt?: string;
}

export default function FinancePage() {
  const { user, loading: authLoading } = useAuth();
  const { previewImage } = useImagePreview();
  const navigate = useNavigate();
  const [data, setData] = useState<FinanceInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 倒计时当前时间（每分钟刷新）
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 实际到账收入统计 + 近3天咨询费明细
  const [income, setIncome] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [showDaily, setShowDaily] = useState(false);
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const [inc, rec] = await Promise.all([
          getIncomeStats(),
          getRecentConsult(3),
        ]);
        setIncome(inc);
        setRecent(rec);
      } catch (e) {
        logger.error('获取收入统计失败', e);
      }
    })();
  }, [authLoading, user]);

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
      setError(getErrorMessage(err, '加载资金数据'));
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
      label: '有效直推人数',
      value: `${data?.directInviteCount || 0}人`,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
  ];

  // ── 可返回流失（四星考核平台代收）倒计时 ──
  const fourStarTime = data?.fourStarAt ? new Date(data.fourStarAt).getTime() : null;
  const day30Deadline = fourStarTime ? fourStarTime + 30 * 86400000 : null;
  const day60Deadline = fourStarTime ? fourStarTime + 60 * 86400000 : null;

  function formatRemain(ms: number): string {
    if (ms <= 0) return '已截止';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}天${hours}小时`;
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}小时${mins}分`;
  }

  let reclaimWindow: { text: string; remain?: string; tone: string } | null = null;
  if (fourStarTime && day30Deadline && day60Deadline) {
    if (data?.assessmentStatus === 'collecting') {
      if (nowTs < day30Deadline) {
        reclaimWindow = { text: '100% 全额返还窗口', remain: formatRemain(day30Deadline - nowTs), tone: 'text-green-600' };
      } else if (nowTs < day60Deadline) {
        reclaimWindow = { text: '50% 返还窗口', remain: formatRemain(day60Deadline - nowTs), tone: 'text-orange-600' };
      } else {
        reclaimWindow = { text: '返还窗口已关闭', tone: 'text-red-600' };
      }
    } else if (data?.assessmentStatus === 'passed') {
      reclaimWindow = {
        text: data.refundStatus === 'confirmed' ? '已达标，返还已打款' : '已达标，待平台打款',
        tone: 'text-green-600',
      };
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* 实际到账收入（以确认收款为准，商城/咨询分开） */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-500" />
            我的收入（实际到账）
          </h2>
          <button
            onClick={() => setShowDaily((v) => !v)}
            className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1"
          >
            {showDaily ? '收起日期表' : '查看每日收入'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">咨询费</div>
            <div className="text-sm font-bold text-green-600">¥{(income?.totalConsult ?? 0).toFixed(2)}</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">商城</div>
            <div className="text-sm font-bold text-orange-600">¥{(income?.totalMall ?? 0).toFixed(2)}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">合计</div>
            <div className="text-sm font-bold text-gray-900">¥{(income?.total ?? 0).toFixed(2)}</div>
          </div>
        </div>
        {showDaily && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 font-medium">日期</th>
                  <th className="text-right py-2 font-medium">咨询费</th>
                  <th className="text-right py-2 font-medium">商城</th>
                  <th className="text-right py-2 font-medium">合计</th>
                </tr>
              </thead>
              <tbody>
                {(income?.daily ?? []).map((d: any) => (
                  <tr key={d.date} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{d.date}</td>
                    <td className="py-2 text-right text-green-600">{d.consult.toFixed(2)}</td>
                    <td className="py-2 text-right text-orange-600">{d.mall.toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{d.total.toFixed(2)}</td>
                  </tr>
                ))}
                {(income?.daily ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-400">暂无收入记录</td></tr>
                )}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">仅统计已确认收到的款项；零元当天不入表。</p>
          </div>
        )}
      </div>

      {/* 最近3天咨询费到账明细 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-orange-500" />
          最近3天咨询费到账
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">近3天暂无咨询费到账</p>
        ) : (
          <div className="space-y-3">
            {recent.map((it: any) => (
              <div key={it.orderNo} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                  {it.screenshotUrl ? (
                    <Image src={it.screenshotUrl} alt="支付截图" className="w-full h-full object-cover cursor-zoom-in" onClick={() => previewImage(it.screenshotUrl)} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">无图</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">¥{it.amount.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {it.payerNickname || '未命名'} {it.payerPhone} · {LEVEL_NAMES[it.payerLevel] ?? '初级'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {it.confirmedAt
                      ? new Date(it.confirmedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">点击缩略图可查看支付凭证大图。</p>
      </div>

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
                {LEVEL_NAMES['level_7']}：可享受7层内团队收益
              </li>
              <li>
                {LEVEL_NAMES['level_8']}：可享受8层内团队收益
              </li>
              <li>
                {LEVEL_NAMES['level_9']}：可享受9层内团队收益
              </li>
            </ul>
            <p className="pt-1 text-orange-600">
              升级到更高等级可以扩大团队层级，减少超层流失。
            </p>
          </div>
        </div>
      </div>

      {/* 永久流失咨询费（收款人级别不够，收不回） */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Ban className="h-5 w-5 text-red-500" />
          永久流失咨询费
        </h2>
        <div className="bg-red-50 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm text-gray-600">累计永久流失金额</span>
          <span className="text-lg font-bold text-red-600">
            ¥{data?.permanentLossAmount || '0'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          收取某级升级任务的咨询费时，收款人级别须达到该任务的目标级别；级别不足时，该笔咨询费由平台收取且不可返还。直推人在累计收款满 5100 元前不受此限制，升级可避免后续再发生此类流失。
        </p>
      </div>

      {/* 可返回流失咨询费（四星考核平台临时代收） */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <RotateCcw className="h-5 w-5 text-orange-500" />
          可返回流失咨询费
        </h2>
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">平台累计代收</span>
            <span className="text-lg font-bold text-orange-600">
              ¥{data?.platformCollectedAmount || '0'}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-gray-200 pt-3">
            <span className="text-sm text-gray-500">已返还金额</span>
            <span className="text-sm font-semibold text-green-600">
              ¥{data?.refundedAmount || '0'}
            </span>
          </div>
          {reclaimWindow && (
            <div className="flex justify-between items-center border-t border-gray-200 pt-3">
              <span className={`text-sm font-medium ${reclaimWindow.tone}`}>
                {reclaimWindow.text}
              </span>
              {reclaimWindow.remain && (
                <span className={`text-sm font-semibold ${reclaimWindow.tone}`}>
                  {reclaimWindow.remain}
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          成为四星咨询师后，若直推有效四星不足 3 人，期间咨询费由平台临时代收：30 天内拉满 3 人 100% 返还，60 天内拉满返还 50%，超过 60 天未达标账号失效。达标后自动生成返还打款申请，平台按您的收款码支付。
        </p>
      </div>
    </div>
  );
}
