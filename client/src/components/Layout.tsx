import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, User, LogOut, LogIn, UserPlus, Settings, MessageCircle, ClipboardList,
} from 'lucide-react';
import { getUpgradeCenter, getReceivedConsultOrders } from '../api';
import { TASK_STATUS, CONSULT_ORDER_STATUS, LEVEL_LAYERS } from '@shared/api.interface';
import { playNewTaskSound, playReviewSound } from '../utils/notification-sound';
import { PendingOrderBanner } from './PendingOrderBanner';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const prevTaskRef = useRef(0);
  const prevReviewRef = useRef(0);

  const totalPending = pendingTaskCount + pendingReviewCount;

  const fetchPendingCount = useCallback(async () => {
    if (!user || !user.isInvited) {
      setPendingTaskCount(0);
      setPendingReviewCount(0);
      return;
    }
    try {
      const isLevel4Plus = user.level && LEVEL_LAYERS[user.level] >= 4;
      if (!isLevel4Plus) {
        const upgradeResult = await getUpgradeCenter();
        const tasks = (upgradeResult as { tasks?: Array<{ status: string }> }).tasks || [];
        setPendingTaskCount(
          tasks.filter((t) => t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.IN_PROGRESS).length,
        );
      } else {
        setPendingTaskCount(0);
      }
      const reviewResult = await getReceivedConsultOrders({
        status: [CONSULT_ORDER_STATUS.PENDING_CONFIRM, CONSULT_ORDER_STATUS.PENDING_REVIEW].join(','),
        pageSize: 50,
      });
      setPendingReviewCount(
        (reviewResult as { total?: number }).total ||
          (reviewResult as { items?: unknown[] }).items?.length || 0,
      );
    } catch { /* 静默 */ }
  }, [user]);

  useEffect(() => {
    fetchPendingCount();
    const timer = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(timer);
  }, [fetchPendingCount]);

  useEffect(() => {
    if (pendingTaskCount > prevTaskRef.current) {
      playNewTaskSound();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    prevTaskRef.current = pendingTaskCount;
  }, [pendingTaskCount]);

  useEffect(() => {
    if (pendingReviewCount > prevReviewRef.current) {
      playReviewSound();
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
    prevReviewRef.current = pendingReviewCount;
  }, [pendingReviewCount]);

  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') ctx.resume();
        }
      } catch { /* 静默 */ }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const dockItems = [
    { path: '/', label: '首页', icon: Home, badge: 0 },
    { path: '/chat-rooms', label: '互动中心', icon: MessageCircle, badge: 0 },
    { path: '/tasks', label: '任务中心', icon: ClipboardList, badge: totalPending },
    { path: '/profile', label: '我的', icon: User, badge: 0 },
  ];

  const HIDE_DOCK_PREFIX = [
    '/product/', '/order-confirm/', '/order/', '/chat/', '/consultant/',
    '/seller/', '/admin', '/bbs', '/login', '/register', '/forgot', '/splash',
  ];
  const hideDock = HIDE_DOCK_PREFIX.some((p) => location.pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">AI</div>
              <span className="text-lg font-bold text-gray-900">AI快卖</span>
            </button>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {user.phone === '13800000000' && (
                    <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                      <Settings size={16} /><span className="hidden sm:inline">管理后台</span>
                    </button>
                  )}
                  <button onClick={() => navigate('/profile')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 overflow-hidden">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (user.nickname?.charAt(0) || '用')}
                    </div>
                    <span className="hidden sm:inline">{user.nickname}</span>
                  </button>
                  <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                    <LogOut size={16} /><span className="hidden sm:inline">退出</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate('/login')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                    <LogIn size={16} />登录
                  </button>
                  <button onClick={() => navigate('/register')} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition-colors">
                    <UserPlus size={16} />注册
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 relative ' + (hideDock ? '' : 'pb-24 md:pb-8')}>
        <div className="mb-4">
          <PendingOrderBanner />
        </div>
        <Outlet />
      </main>

      {!hideDock && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50 safe-area-bottom">
          <div className="max-w-7xl mx-auto px-2">
            <div className="flex items-center justify-around">
              {dockItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                return (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className={'relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 min-w-[60px] transition-colors active:scale-95 ' + (isActive ? 'text-orange-600' : 'text-gray-500')}>
                    <div className="relative">
                      <Icon size={22} strokeWidth={1.8} />
                      {item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;