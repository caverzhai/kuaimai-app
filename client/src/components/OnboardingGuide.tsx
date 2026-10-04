import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@client/src/contexts/AuthContext';
import { getUpgradeCenter } from '@client/src/api';
import { LEVEL_LAYERS, TASK_STATUS, type UpgradeTaskInfo } from '@shared/api.interface';

type Step = { key: string; label: string; done: boolean; go: () => void };

/**
 * 新手入门引导：未成为四星咨询师的用户，按"实名认证 → 5 笔升级任务 → 升四星"
 * 的顺序逐步完成。当前步高亮并提供"去完成"入口，完成后自动推进，避免新手靠猜。
 */
export function OnboardingGuide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<UpgradeTaskInfo[]>([]);

  const levelNum = user?.level ? LEVEL_LAYERS[user.level] ?? 0 : 0;
  const isLevel4Plus = levelNum >= 4;

  useEffect(() => {
    if (isLevel4Plus) return;
    let alive = true;
    const load = () => {
      getUpgradeCenter()
        .then((d) => {
          if (alive) setTasks((d as { tasks?: UpgradeTaskInfo[] }).tasks || []);
        })
        .catch(() => { /* 静默，任务中心会兜底 */ });
    };
    load();
    // 每 15 秒静默刷新，保证与任务进展同步（修复审核通过后仍提示"去完成/再买一单"）
    const timer = setInterval(load, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isLevel4Plus]);

  // 已是四星及以上，不显示新手引导
  if (!user || isLevel4Plus) return null;

  const idcardDone = !!user.realName && !!user.idCardFrontUrl;
  const sortedTasks = [...tasks].sort((a, b) => a.taskIndex - b.taskIndex);

  const steps: Step[] = [
    { key: 'idcard', label: '完成实名认证（上传身份证正反面）', done: idcardDone, go: () => navigate('/profile', { state: { autoEdit: true } }) },
    ...sortedTasks.map((t) => ({
      key: t.id,
      label: t.title,
      done: t.status === TASK_STATUS.COMPLETED,
      go: () => navigate('/tasks'),
    })),
    { key: 'finish', label: '成为四星咨询师，开通全部赚钱权益', done: false, go: () => navigate('/tasks') },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-400 text-white flex items-center gap-2">
        <Sparkles size={18} />
        <div className="flex-1">
          <p className="text-sm font-semibold">新手入门 · 成为四星咨询师</p>
          <p className="text-xs text-orange-50">按顺序完成，一步一步开通赚钱权益</p>
        </div>
        <span className="text-sm font-bold">{doneCount}/{steps.length}</span>
      </div>
      <div className="p-2">
        {steps.map((s, idx) => {
          const isCurrent = idx === currentIdx;
          return (
            <button
              key={s.key}
              onClick={isCurrent ? s.go : undefined}
              disabled={!isCurrent}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                s.done
                  ? ''
                  : isCurrent
                    ? 'bg-orange-50 active:bg-orange-100'
                    : 'opacity-60'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  s.done
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s.done ? <Check size={14} /> : idx + 1}
              </span>
              <span
                className={`flex-1 text-sm ${
                  s.done
                    ? 'text-gray-400 line-through'
                    : isCurrent
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
              {isCurrent && (
                <span className="text-xs text-orange-500 font-medium flex items-center flex-shrink-0">
                  去完成<ChevronRight size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
