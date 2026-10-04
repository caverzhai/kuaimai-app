import { useState, useEffect } from 'react';
import {
  Clock,
  Users,
  Wallet,
  Copy,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { getAssessment, submitClonePhone } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import { getErrorMessage } from '@client/src/utils/errorMessage';

interface AssessmentInfo {
  status: string;
  fourStarAt?: string;
  day30Deadline?: string;
  day60Deadline?: string;
  daysRemaining?: number;
  targetCount?: number;
  validFourStarCount?: number;
  platformCollectedAmount?: string;
  refundRate?: number | null;
  refundedAmount?: string;
  refundStatus?: string;
}

/**
 * 四星60天考核卡片 + 分身顶替通知
 * - collecting：展示倒计时、有效四星进度、平台代收金额
 * - passed：展示返还比例/金额与打款状态
 * - cloneEligible：展示分身资格，提交新手机号创建分身号
 */
export const AssessmentCard = () => {
  const { user, refreshUser } = useAuth();
  const [info, setInfo] = useState<AssessmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [clonePhone, setClonePhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cloneMsg, setCloneMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    getAssessment()
      .then((d: AssessmentInfo) => {
        if (mounted) setInfo(d);
      })
      .catch(() => {
        if (mounted) setInfo({ status: 'none' });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleClone = async () => {
    const phone = clonePhone.trim();
    if (!/^1\d{10}$/.test(phone)) {
      setCloneMsg({ type: 'err', text: '请输入正确的11位手机号' });
      return;
    }
    setSubmitting(true);
    setCloneMsg(null);
    try {
      await submitClonePhone(phone);
      setCloneMsg({
        type: 'ok',
        text: `分身号已创建，请用手机号 ${phone} 登录，密码与原号一致`,
      });
      setClonePhone('');
      await refreshUser();
    } catch (e: any) {
      setCloneMsg({
        type: 'err',
        text: getErrorMessage(e, '提交分身手机号'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  const isCollecting = info?.status === 'collecting';
  const isPassed = info?.status === 'passed';
  const showClone = !!user?.cloneEligible;

  if (!isCollecting && !isPassed && !showClone) return null;

  return (
    <div className="space-y-3">
      {/* ===== 考核中 ===== */}
      {isCollecting && (
        <section className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-orange-400">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-bold text-gray-900">
              四星考核进行中
            </h3>
            <span className="ml-auto text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
              剩余 {info?.daysRemaining ?? 0} 天
            </span>
          </div>

          <div className="space-y-2.5">
            {/* 有效四星进度 */}
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
              <Users className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="text-xs text-gray-600 flex-1">
                直推有效四星咨询师
              </p>
              <p className="text-sm font-bold text-orange-600">
                {info?.validFourStarCount ?? 0}/{info?.targetCount ?? 3}
              </p>
            </div>

            {/* 平台代收金额 */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
              <Wallet className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-gray-600 flex-1">
                平台暂时代收咨询费
              </p>
              <p className="text-sm font-bold text-amber-700">
                ¥{info?.platformCollectedAmount ?? '0'}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 leading-relaxed">
                考核期内直推满 3 个四星咨询师即通过：
                <span className="text-green-600 font-medium">
                  30天内通过返还100%
                </span>
                ，
                <span className="text-amber-600 font-medium">
                  31-60天通过返还50%
                </span>
                ；满60天未通过账号将失效。卖货货款不受影响。
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===== 已通过 ===== */}
      {isPassed && (
        <section className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-green-400">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-bold text-gray-900">
              四星考核已通过
            </h3>
            <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              返还 {info?.refundRate ?? 0}%
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
            <Wallet className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-gray-600 flex-1">
              {info?.refundStatus === 'pending'
                ? '返还金额待平台打款'
                : '返还金额已打款'}
            </p>
            <p className="text-sm font-bold text-green-700">
              ¥{info?.refundedAmount ?? '0'}
            </p>
          </div>
        </section>
      )}

      {/* ===== 分身资格通知 ===== */}
      {showClone && (
        <section className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-sm p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-sm font-bold">恭喜获得分身号资格</h3>
          </div>
          <p className="text-xs text-white/90 leading-relaxed mb-3">
            您因直推满 10 个四星咨询师获得分身资格。请提供一个新的手机号，
            系统将复制您的实名信息、收款码与密码创建分身号，占据空位，
            两个位置均可收款，分身号与原号各自升级。
          </p>

          {cloneMsg?.type === 'ok' ? (
            <div className="flex items-start gap-2 p-3 bg-white/20 rounded-xl">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{cloneMsg.text}</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={clonePhone}
                  onChange={(e) =>
                    setClonePhone(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="输入分身号新手机号"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/60"
                />
                <button
                  onClick={handleClone}
                  disabled={submitting}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 bg-white text-orange-600 text-sm font-bold rounded-lg disabled:opacity-70"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  创建
                </button>
              </div>
              {cloneMsg?.type === 'err' && (
                <div className="flex items-start gap-1.5 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-white/95">{cloneMsg.text}</p>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
};
