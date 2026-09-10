import { useState, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUpgradeCenter as apiGetUpgradeCenter,
  startUpgradeTask as apiStartUpgradeTask,
} from '../../api';
import type {
  UpgradeCenterInfo,
  UpgradeTaskInfo,
} from '@shared/api.interface';
import {
  TASK_STATUS,
  TASK_TYPE,
  LEVEL_NAMES,
  LEVEL_LAYERS,
} from '@shared/api.interface';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  Play,
  ShoppingCart,
  MessageSquare,
  AlertTriangle,
  Crown,
  UserPlus,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export default function UpgradeCenterPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<UpgradeCenterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
  }, [authLoading, user]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetUpgradeCenter();
      setData(result as UpgradeCenterInfo);
    } catch (err) {
      logger.error('获取升级中心数据失败', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(task: UpgradeTaskInfo) {
    setStartingId(task.id);
    try {
      await apiStartUpgradeTask(task.id);
      await fetchData();
    } catch (err) {
      logger.error('开始任务失败', err);
      setError('开始任务失败，请稍后重试');
    } finally {
      setStartingId(null);
    }
  }

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
        <AlertTriangle className="h-10 w-10 text-orange-500" />
        <p className="text-gray-600">请登录后查看升级中心</p>
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

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-muted-foreground">请先登录后查看升级中心</div>
      </div>
    );
  }

  if (!user.isInvited) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
          <UserPlus className="h-12 w-12 text-orange-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            请先补充邀请码
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            升级中心仅对已被邀请的用户开放，请先补充邀请码激活账号
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            去补充邀请码
          </button>
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

  if (!data) return null;

  const currentLevelName = LEVEL_NAMES[data.currentLevel] || data.currentLevel;
  const nextLevelName = data.nextLevel
    ? LEVEL_NAMES[data.nextLevel] || data.nextLevel
    : null;
  const currentLayer = LEVEL_LAYERS[data.currentLevel] || 0;
  const isMaxLevel = !data.nextLevel;
  const isLevel7Upgrade = data.nextLevel === 'level_7';

  const totalTasks = data.tasks.length;
  const completedTasks = data.tasks.filter(
    (t: UpgradeTaskInfo) => t.status === TASK_STATUS.COMPLETED,
  ).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* 顶部等级卡片 */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-80 mb-1">当前等级</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Crown className="h-6 w-6" />
              {currentLevelName}
            </div>
          </div>
          <div className="text-right">
            {nextLevelName ? (
              <>
                <div className="text-sm opacity-80 mb-1">下一等级</div>
                <div className="text-lg font-semibold">{nextLevelName}</div>
              </>
            ) : (
              <div className="text-sm opacity-90 font-medium">
                已是最高等级
              </div>
            )}
          </div>
        </div>

        {!isMaxLevel && (
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-2 opacity-90">
              <span>升级进度</span>
              <span>
                {completedTasks} / {totalTasks} 个任务
              </span>
            </div>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 7级升级公司资质提示 */}
      {isLevel7Upgrade && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-amber-800 mb-1">
              升级到7级咨询团需要公司资质审核
            </div>
            <div className="text-xs text-amber-700">
              完成所有升级任务后，请前往个人中心提交公司营业执照进行资质审核
            </div>
          </div>
        </div>
      )}

      {/* 最高等级提示 */}
      {isMaxLevel && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 text-center">
          <Crown className="h-12 w-12 text-amber-500 mx-auto mb-2" />
          <div className="text-lg font-semibold text-amber-800">
            恭喜，您已是最高等级！
          </div>
          <div className="text-sm text-amber-600 mt-1">
            当前等级：{currentLevelName}（第{currentLayer}层）
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {!isMaxLevel && data.tasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            升级任务
          </h2>

          <div className="space-y-3">
            {data.tasks.map((task: UpgradeTaskInfo, index: number) => {
              const isCompleted = task.status === TASK_STATUS.COMPLETED;
              const isInProgress = task.status === TASK_STATUS.IN_PROGRESS;
              const isPending = task.status === TASK_STATUS.PENDING;
              const isMall = task.taskType === TASK_TYPE.MALL_PURCHASE;
              const isConsult = task.taskType === TASK_TYPE.CONSULT_SERVICE;
              const prevTask = index > 0 ? data.tasks[index - 1] : null;
              const canStart =
                isPending &&
                (!prevTask || prevTask.status === TASK_STATUS.COMPLETED);

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* 序号 */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isCompleted
                          ? 'bg-green-100 text-green-600'
                          : isInProgress
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        task.taskIndex
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-gray-900 text-base">
                          {task.title}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                            isCompleted
                              ? 'bg-green-50 text-green-600'
                              : isInProgress
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isCompleted
                            ? '已完成'
                            : isInProgress
                              ? '进行中'
                              : '待开始'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          {isMall ? (
                            <>
                              <ShoppingCart className="h-4 w-4" />
                              商城购买
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4" />
                              咨询服务
                            </>
                          )}
                        </span>
                        <span className="text-orange-500 font-semibold">
                          ¥{task.amount}
                        </span>
                      </div>

                      {/* 咨询服务显示目标人 */}
                      {isConsult && task.targetId && (
                        <div className="mt-2 text-xs text-gray-500">
                          目标咨询师 ID：{task.targetId}
                        </div>
                      )}

                      {/* 完成时间 */}
                      {isCompleted && task.completedAt && (
                        <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          完成于{' '}
                          {new Date(task.completedAt).toLocaleString()}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="mt-3">
                        {isPending && canStart && (
                          <button
                            onClick={() => handleStart(task)}
                            disabled={startingId === task.id}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {startingId === task.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                处理中
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4" />
                                开始任务
                              </>
                            )}
                          </button>
                        )}
                        {isPending && !canStart && (
                          <span className="text-xs text-gray-400">
                            请先完成前置任务
                          </span>
                        )}
                        {isInProgress && isMall && (
                          <button
                            onClick={() => navigate('/mall')}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            去商城购买
                          </button>
                        )}
                        {isInProgress && isConsult && (
                          <button
                            onClick={() =>
                              navigate(`/consultant/${task.targetId}`)
                            }
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <MessageSquare className="h-4 w-4" />
                            去购买服务
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
