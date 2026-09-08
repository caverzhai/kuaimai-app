import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUpgradeCenter as apiGetUpgradeCenter,
  startUpgradeTask as apiStartUpgradeTask,
  getReceivedConsultOrders,
  getMyConsultOrders,
  getMyMallOrders,
  confirmConsultPayment,
  reviewConsultWork,
  getConsultantDetail,
} from '../../api';
import type {
  UpgradeCenterInfo,
  UpgradeTaskInfo,
  ConsultOrderInfo,
  ConsultantInfo,
} from '@shared/api.interface';
import {
  TASK_STATUS,
  TASK_TYPE,
  LEVEL_NAMES,
  LEVEL_LAYERS,
  CONSULT_ORDER_STATUS,
  CONSULT_ORDER_STATUS_NAMES,
} from '@shared/api.interface';
import {
  ClipboardList,
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
  Bell,
  Inbox,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { playNewTaskSound, playReviewSound } from '../../utils/notification-sound';

type TabType = 'tasks' | 'review' | 'notifications';

// 咨询师联系方式组件：显示上级手机号，可点击拨打
function ConsultantContact({ consultantId }: { consultantId: string }) {
  const [consultant, setConsultant] = useState<ConsultantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getConsultantDetail(consultantId);
        if (!cancelled) setConsultant(data as ConsultantInfo);
      } catch (e) {
        logger.error('获取咨询师信息失败', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [consultantId]);

  if (loading) {
    return <div className="text-xs text-gray-400">加载上级联系方式...</div>;
  }

  if (!consultant?.phone) {
    return null;
  }

  return (
    <a
      href={`tel:${consultant.phone}`}
      className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
    >
      <Phone size={14} className="text-blue-500 flex-shrink-0" />
      <span className="text-xs text-blue-600 font-medium">
        上级：{consultant.nickname}
      </span>
      <span className="text-xs text-blue-600 font-medium ml-auto flex items-center gap-1">
        <Phone size={12} />
        电话催促审核
      </span>
    </a>
  );
}

export default function TaskCenterPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('tasks');

  // 升级任务数据
  const [upgradeData, setUpgradeData] = useState<UpgradeCenterInfo | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  // 待审核订单数据
  const [reviewOrders, setReviewOrders] = useState<ConsultOrderInfo[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // 我的咨询订单（用于防重复购买）
  const [myOrders, setMyOrders] = useState<ConsultOrderInfo[]>([]);
  // 我的商城订单（用于防重复购买）
  const [myMallOrders, setMyMallOrders] = useState<any[]>([]);
  // 当前时间（用于倒计时）
  const [now, setNow] = useState(Date.now());

  // 提醒数据
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'warning' | 'info' | 'success';
    title: string;
    content: string;
    time: string;
    read: boolean;
  }>>([]);

  // 用于检测新任务的上一次数量
  const prevTaskCountRef = useRef<number>(0);
  const prevReviewCountRef = useRef<number>(0);

  // 计算待办总数
  const pendingTaskCount = upgradeData
    ? upgradeData.tasks.filter(
        (t) => t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.IN_PROGRESS,
      ).length
    : 0;
  const pendingReviewCount = reviewOrders.length;
  const totalPending = pendingTaskCount + pendingReviewCount;

  // 检测新任务并播放声音
  useEffect(() => {
    if (prevTaskCountRef.current > 0 && pendingTaskCount > prevTaskCountRef.current) {
      playNewTaskSound();
    }
    prevTaskCountRef.current = pendingTaskCount;
  }, [pendingTaskCount]);

  useEffect(() => {
    if (prevReviewCountRef.current > 0 && pendingReviewCount > prevReviewCountRef.current) {
      playReviewSound();
    }
    prevReviewCountRef.current = pendingReviewCount;
  }, [pendingReviewCount]);

  // 加载升级任务
  const fetchUpgradeData = useCallback(async () => {
    if (!user) return;
    setUpgradeLoading(true);
    try {
      const [upgradeResult, ordersResult, mallOrdersResult] = await Promise.all([
        apiGetUpgradeCenter(),
        getMyConsultOrders({
          status: [CONSULT_ORDER_STATUS.PENDING_CONFIRM, CONSULT_ORDER_STATUS.PENDING_REVIEW, CONSULT_ORDER_STATUS.IN_SERVICE].join(','),
          pageSize: 50,
        }).catch(() => ({ items: [] })),
        getMyMallOrders({
          status: 'pending_review,pending_shipment,shipped',
          pageSize: 50,
        }).catch(() => ({ items: [] })),
      ]);
      setUpgradeData(upgradeResult as UpgradeCenterInfo);
      setMyOrders((ordersResult as { items: ConsultOrderInfo[] }).items || []);
      setMyMallOrders((mallOrdersResult as { items: any[] }).items || []);
    } catch (err) {
      logger.error('获取升级任务失败', err);
    } finally {
      setUpgradeLoading(false);
    }
  }, [user]);

  // 加载待审核订单
  const fetchReviewOrders = useCallback(async () => {
    if (!user) return;
    setReviewLoading(true);
    try {
      const result = await getReceivedConsultOrders({
        status: [CONSULT_ORDER_STATUS.PENDING_CONFIRM, CONSULT_ORDER_STATUS.PENDING_REVIEW].join(','),
        pageSize: 50,
      });
      setReviewOrders((result as { items: ConsultOrderInfo[] }).items || []);
    } catch (err) {
      logger.error('获取待审核订单失败', err);
      setReviewOrders([]);
    } finally {
      setReviewLoading(false);
    }
  }, [user]);

  // 生成提醒
  const generateNotifications = useCallback(() => {
    const list: Array<{
      id: string;
      type: 'warning' | 'info' | 'success';
      title: string;
      content: string;
      time: string;
      read: boolean;
    }> = [];

    if (user) {
      // 900元门槛提醒
      if (user.thresholdBlocked) {
        const triggeredAt = user.thresholdTriggeredAt
          ? new Date(user.thresholdTriggeredAt)
          : null;
        const daysLeft = triggeredAt
          ? Math.max(0, 60 - Math.floor((Date.now() - triggeredAt.getTime()) / (1000 * 60 * 60 * 24)))
          : 60;
        list.push({
          id: 'threshold',
          type: 'warning',
          title: '收款权限受限',
          content: `累计咨询费超900元且直推不足3人，当前收款已被暂存。待收回金额：¥${user.pendingReclaimAmount}。30天内完成3直推返还100%，60天内返还50%。剩余约${daysLeft}天。`,
          time: new Date().toLocaleString(),
          read: false,
        });
      }

      // 超层流失提醒
      if (parseFloat(user.overflowLossAmount) > 0) {
        list.push({
          id: 'overflow',
          type: 'info',
          title: '超层流失金额',
          content: `当前等级可向下收取${LEVEL_LAYERS[user.level] || 0}层咨询费，超出层级的服务费由咨询师团代收。累计超层流失金额：¥${user.overflowLossAmount}。`,
          time: new Date().toLocaleString(),
          read: false,
        });
      }

      // 7级资质审核提醒
      if (user.companyAuditStatus === 'pending') {
        list.push({
          id: 'company_audit',
          type: 'info',
          title: '公司资质审核中',
          content: '您的公司营业执照和收款码正在审核中，请耐心等待平台审核结果。',
          time: new Date().toLocaleString(),
          read: false,
        });
      }

      // 未补充邀请码提醒
      if (!user.isInvited) {
        list.push({
          id: 'no_invite',
          type: 'warning',
          title: '未绑定邀请人',
          content: '您当前未绑定邀请人，无法使用咨询师功能和升级任务。请补充邀请码激活完整功能。',
          time: new Date().toLocaleString(),
          read: false,
        });
      }

      // 直推不足提醒
      if (user.isInvited && user.level !== 'junior' && user.directInviteCount < 3) {
        list.push({
          id: 'low_invite',
          type: 'info',
          title: '直推名额不足',
          content: `当前直推人数：${user.directInviteCount}/3。完成3个直推后可永久解除收款限制，稳定收取线下咨询费。`,
          time: new Date().toLocaleString(),
          read: false,
        });
      }
    }

    setNotifications(list);
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchUpgradeData();
    fetchReviewOrders();
    generateNotifications();
    // 注意：不在这里调用 refreshUser，避免无限循环
    // AuthContext 已经在启动时调用了 fetchUser
  }, [authLoading, user, fetchUpgradeData, fetchReviewOrders, generateNotifications]);

  // 轮询待审核订单（每30秒）
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      fetchReviewOrders();
    }, 30000);
    return () => clearInterval(timer);
  }, [user, fetchReviewOrders]);

  // 页面获得焦点时自动刷新（防止重复购买）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchUpgradeData();
        fetchReviewOrders();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [user, fetchUpgradeData, fetchReviewOrders]);

  // 倒计时定时器（每秒更新）
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 格式化倒计时
  const formatCountdown = (deadline?: string): string => {
    if (!deadline) return '';
    const remain = new Date(deadline).getTime() - now;
    if (remain <= 0) return '官方即将介入';
    const minutes = Math.floor(remain / 60000);
    const seconds = Math.floor((remain % 60000) / 1000);
    return `官方介入时间：${minutes}分${seconds.toString().padStart(2, '0')}秒`;
  };

  // 计算自动审核截止时间（创建时间+20分钟）
  const getAutoConfirmDeadline = (createdAt?: string): string | undefined => {
    if (!createdAt) return undefined;
    const deadline = new Date(createdAt);
    deadline.setMinutes(deadline.getMinutes() + 20);
    return deadline.toISOString();
  };

  async function handleStart(task: UpgradeTaskInfo) {
    setStartingId(task.id);
    try {
      await apiStartUpgradeTask(task.id);
      await fetchUpgradeData();
    } catch (err) {
      logger.error('开始任务失败', err);
    } finally {
      setStartingId(null);
    }
  }

  async function handleConfirmPayment(orderId: string) {
    setReviewingId(orderId);
    try {
      await confirmConsultPayment(orderId);
      await fetchReviewOrders();
    } catch (err) {
      logger.error('确认收款失败', err);
    } finally {
      setReviewingId(null);
    }
  }

  async function handleReviewWork(orderId: string, passed: boolean) {
    setReviewingId(orderId);
    try {
      await reviewConsultWork(orderId, passed, passed ? '' : '作业不符合要求，请重新提交');
      await fetchReviewOrders();
    } catch (err) {
      logger.error('审核作业失败', err);
    } finally {
      setReviewingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 flex items-center gap-2">
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
        <p className="text-gray-600">请登录后查看任务中心</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          去登录
        </button>
      </div>
    );
  }

  const currentLevelName = LEVEL_NAMES[user.level] || user.level;
  const currentLayer = LEVEL_LAYERS[user.level] || 0;

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* 顶部标题栏 */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-5 text-white shadow-lg mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">任务中心</h1>
              <p className="text-xs opacity-80">
                {currentLevelName}
                {currentLayer > 0 && ` · 可向下收${currentLayer}层`}
              </p>
            </div>
          </div>
          {totalPending > 0 && (
            <div className="bg-white text-orange-500 px-3 py-1 rounded-full text-sm font-bold">
              {totalPending} 项待办
            </div>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm border border-gray-100">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'tasks'
              ? 'bg-orange-500 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          待完成任务
          {pendingTaskCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === 'tasks' ? 'bg-white/20' : 'bg-orange-100 text-orange-600'
            }`}>
              {pendingTaskCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'review'
              ? 'bg-orange-500 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Inbox className="h-4 w-4" />
          待我审核
          {pendingReviewCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === 'review' ? 'bg-white/20' : 'bg-red-100 text-red-600'
            }`}>
              {pendingReviewCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'notifications'
              ? 'bg-orange-500 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Bell className="h-4 w-4" />
          提醒
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === 'notifications' ? 'bg-white/20' : 'bg-amber-100 text-amber-600'
            }`}>
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </button>
      </div>

      {/* 待完成任务 Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {!user.isInvited ? (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
              <UserPlus className="h-12 w-12 text-orange-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">请先补充邀请码</h2>
              <p className="text-sm text-gray-600 mb-4">
                升级任务仅对已被邀请的用户开放，请先补充邀请码激活账号
              </p>
              <button
                onClick={() => navigate('/supplement-inviter')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                去补充邀请码
              </button>
            </div>
          ) : upgradeLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            </div>
          ) : !upgradeData ? (
            <div className="text-center py-10 text-gray-400">
              <RefreshCw className="h-8 w-8 mx-auto mb-2" />
              加载失败，请下拉刷新
            </div>
          ) : upgradeData.tasks.length === 0 ? (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 text-center">
              <Crown className="h-12 w-12 text-amber-500 mx-auto mb-2" />
              <div className="text-lg font-semibold text-amber-800">恭喜，您已是最高等级！</div>
              <div className="text-sm text-amber-600 mt-1">
                当前等级：{currentLevelName}（第{currentLayer}层）
              </div>
            </div>
          ) : (
            <>
              {/* 升级进度 */}
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    升级至 {upgradeData.nextLevel ? LEVEL_NAMES[upgradeData.nextLevel] : ''}
                  </span>
                  <span className="text-xs text-gray-500">
                    {upgradeData.tasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length} / {upgradeData.tasks.length} 已完成
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${(upgradeData.tasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length / upgradeData.tasks.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* 任务列表 */}
              {upgradeData.tasks.map((task: UpgradeTaskInfo, index: number) => {
                const isCompleted = task.status === TASK_STATUS.COMPLETED;
                const isInProgress = task.status === TASK_STATUS.IN_PROGRESS;
                const isPending = task.status === TASK_STATUS.PENDING;
                const isMall = task.taskType === TASK_TYPE.MALL_PURCHASE;
                const prevTask = index > 0 ? upgradeData.tasks[index - 1] : null;
                const canStart =
                  isPending && (!prevTask || prevTask.status === TASK_STATUS.COMPLETED);

                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-xl border p-4 shadow-sm transition-all ${
                      isCompleted
                        ? 'border-green-100 opacity-75'
                        : isInProgress
                          ? 'border-orange-200 ring-1 ring-orange-100'
                          : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isCompleted
                            ? 'bg-green-100 text-green-600'
                            : isInProgress
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isCompleted ? <CheckCircle className="h-5 w-5" /> : task.taskIndex}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-gray-900 text-base">{task.title}</h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                              isCompleted
                                ? 'bg-green-50 text-green-600'
                                : isInProgress
                                  ? 'bg-orange-50 text-orange-600'
                                  : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {isCompleted ? '已完成' : isInProgress ? '进行中' : '待开始'}
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
                          <span className="text-orange-500 font-semibold">¥{task.amount}</span>
                        </div>

                        {isCompleted && task.completedAt && (
                          <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            完成于 {new Date(task.completedAt).toLocaleString()}
                          </div>
                        )}

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
                            <span className="text-xs text-gray-400">请先完成前置任务</span>
                          )}
                          {isInProgress && isMall && (
                            <div className="flex flex-col gap-2">
                              {/* 检查是否已经有商城订单待审核/待发货/已发货 */}
                              {myMallOrders.length > 0 ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4" />
                                    已购买成功，请等待平台审核
                                  </p>
                                  <p className="text-xs text-green-600 mt-1">
                                    付款截图已上传，平台审核后任务自动完成。
                                  </p>
                                  {(() => {
                                    const order = myMallOrders[0];
                                    const deadline = order?.autoConfirmDeadline || getAutoConfirmDeadline(order?.createdAt);
                                    const countdown = formatCountdown(deadline);
                                    return countdown ? (
                                      <p className="text-xs text-orange-600 mt-1 font-medium">
                                        ⏱ {countdown}
                                      </p>
                                    ) : null;
                                  })()}
                                </div>
                              ) : (
                                <button
                                  onClick={() => navigate(`/mall?taskAmount=${task.amount}&taskId=${task.id}`)}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 w-fit"
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                  去商城购买¥{task.amount}
                                </button>
                              )}
                              <button
                                onClick={() => navigate('/my-orders')}
                                className="text-xs text-orange-500 hover:text-orange-600 underline w-fit"
                              >
                                查看我的订单 →
                              </button>
                              <span className="text-xs text-gray-400">购买后上传付款截图，等待平台审核</span>
                            </div>
                          )}
                          {isInProgress && !isMall && (
                            <div className="flex flex-col gap-2">
                              {task.targetId ? (
                                <>
                                  <ConsultantContact consultantId={task.targetId} />
                                  {/* 检查是否已经购买过该任务的服务（待确认/服务中/待审核） */}
                                  {myOrders.some((o) => o.taskId === task.id && 
                                    [CONSULT_ORDER_STATUS.PENDING_CONFIRM, CONSULT_ORDER_STATUS.IN_SERVICE, CONSULT_ORDER_STATUS.PENDING_REVIEW].includes(o.status as any)) ? (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                                        <CheckCircle className="h-4 w-4" />
                                        已购买成功，请等待上级确认
                                      </p>
                                      <p className="text-xs text-green-600 mt-1">
                                        付款截图已上传，上级确认后任务自动完成。
                                      </p>
                                      {(() => {
                                        const order = myOrders.find((o) => o.taskId === task.id);
                                        const deadline = order?.autoConfirmDeadline || getAutoConfirmDeadline(order?.createdAt);
                                        const countdown = formatCountdown(deadline);
                                        return countdown ? (
                                          <p className="text-xs text-orange-600 mt-1 font-medium">
                                            ⏱ {countdown}
                                          </p>
                                        ) : null;
                                      })()}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => navigate(`/consultant/${task.targetId}?amount=${task.amount}&taskId=${task.id}`)}
                                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 w-fit"
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                      去购买服务（{task.amount}元）
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <p className="text-sm text-amber-700 font-medium">暂无直推人</p>
                                  <p className="text-xs text-amber-600 mt-1">您的直推人暂未设置，咨询服务款项将由平台代收。请联系平台客服完成咨询服务购买。</p>
                                  <button
                                    onClick={() => navigate('/consultants')}
                                    className="mt-2 text-xs text-orange-500 hover:text-orange-600 underline"
                                  >
                                    浏览咨询师列表 →
                                  </button>
                                </div>
                              )}
                              <button
                                onClick={() => navigate('/consult-orders')}
                                className="text-xs text-orange-500 hover:text-orange-600 underline w-fit"
                              >
                                查看咨询订单 →
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* 待我审核 Tab */}
      {activeTab === 'review' && (
        <div className="space-y-3">
          {reviewLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            </div>
          ) : reviewOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Inbox className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm">暂无待审核事项</p>
              <p className="text-xs mt-1">有新的审核任务时会在这里显示并声音提醒</p>
            </div>
          ) : (
            reviewOrders.map((order) => {
              const isPendingConfirm = order.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM;
              const isPendingReview = order.status === CONSULT_ORDER_STATUS.PENDING_REVIEW;
              const student = order.student;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                        {student?.nickname?.charAt(0) || '学'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {student?.nickname || '学员'}
                        </div>
                        <div className="text-xs text-gray-400">订单号：{order.orderNo}</div>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isPendingConfirm
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {CONSULT_ORDER_STATUS_NAMES[order.status] || order.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-500">服务金额</span>
                    <span className="text-orange-500 font-bold text-lg">¥{order.amount}</span>
                  </div>

                  {/* 自动审核倒计时 */}
                  {(isPendingConfirm || isPendingReview) && (
                    <div className="mb-3 p-2 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-amber-600">
                        <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <span className="font-medium">{formatCountdown(order.autoConfirmDeadline || getAutoConfirmDeadline(order.createdAt))}</span>
                      </div>
                      <p className="text-xs text-amber-500 mt-1">超时未审核将由系统自动确认通过</p>
                    </div>
                  )}

                  {isPendingConfirm && order.paymentScreenshotUrl && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1.5">付款截图</div>
                      <img
                        src={order.paymentScreenshotUrl}
                        alt="付款截图"
                        className="w-full max-w-xs rounded-lg border border-gray-200"
                      />
                    </div>
                  )}

                  {isPendingReview && order.workScreenshotUrl && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1.5">作业截图</div>
                      <img
                        src={order.workScreenshotUrl}
                        alt="作业截图"
                        className="w-full max-w-xs rounded-lg border border-gray-200"
                      />
                    </div>
                  )}

                  {order.autoConfirmDeadline && (
                    <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      20分钟未审核将自动确认，截止：
                      {new Date(order.autoConfirmDeadline).toLocaleTimeString()}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {isPendingConfirm && (
                      <button
                        onClick={() => handleConfirmPayment(order.id)}
                        disabled={reviewingId === order.id}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {reviewingId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        确认收款
                      </button>
                    )}
                    {isPendingReview && (
                      <>
                        <button
                          onClick={() => handleReviewWork(order.id, true)}
                          disabled={reviewingId === order.id}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {reviewingId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ThumbsUp className="h-4 w-4" />
                          )}
                          通过
                        </button>
                        <button
                          onClick={() => handleReviewWork(order.id, false)}
                          disabled={reviewingId === order.id}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <ThumbsDown className="h-4 w-4" />
                          驳回
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => navigate(`/consult-orders`)}
                      className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm transition-colors flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      详情
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 提醒 Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Bell className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm">暂无提醒</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border p-4 shadow-sm ${
                  item.type === 'warning'
                    ? 'border-amber-200'
                    : item.type === 'success'
                      ? 'border-green-200'
                      : 'border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.type === 'warning'
                        ? 'bg-amber-50 text-amber-500'
                        : item.type === 'success'
                          ? 'bg-green-50 text-green-500'
                          : 'bg-blue-50 text-blue-500'
                    }`}
                  >
                    {item.type === 'warning' ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : item.type === 'success' ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Bell className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 text-sm">{item.title}</h3>
                      {!item.read && (
                        <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{item.content}</p>
                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.time}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
