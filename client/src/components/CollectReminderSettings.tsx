import { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  Volume2,
  BatteryCharging,
  Zap,
  ChevronDown,
  Check,
  ShieldAlert,
  AlarmClock,
  Maximize,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  isNativeApp,
  startCollectMonitor,
  stopCollectMonitor,
  hasNotifyPermission,
  requestNotifyPermission,
  isIgnoringBattery,
  requestIgnoreBattery,
  openAutoStartSettings,
  isCollectEnabled,
  canUseFullScreenNotification,
  requestFullScreenNotification,
  canUseExactAlarm,
  requestExactAlarm,
  waitForBridge,
} from '../utils/collectReminder';

const TOKEN_KEY = 'kuaimai_token';

type BridgeState = 'checking' | 'ready' | 'missing';

function PermissionRow({
  icon,
  title,
  ok,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  ok: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800">{title}</div>
      </div>
      {ok ? (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium flex-shrink-0">
          <Check className="h-3.5 w-3.5" />
          已开启
        </span>
      ) : (
        <button
          onClick={onAction}
          className="text-xs bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function CollectReminderSettings() {
  const native = isNativeApp();
  const win = window as any;
  const cap0 = win.Capacitor;
  const diag = {
    hasCap: !!cap0,
    capPlatform: cap0?.platform ?? '—',
    isNativeFnType: typeof cap0?.isNativePlatform,
    isNativeProp: cap0?.isNative,
    hasAppUpdate: !!win.AppUpdate,
    hasNativeHttp: !!win.NativeHttp,
  };
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notifyOk, setNotifyOk] = useState(true);
  const [batteryOk, setBatteryOk] = useState(true);
  const [fullScreenOk, setFullScreenOk] = useState(true);
  const [exactAlarmOk, setExactAlarmOk] = useState(true);
  const [bridgeState, setBridgeState] = useState<BridgeState>('checking');

  const refresh = () => {
    setEnabled(isCollectEnabled());
    setNotifyOk(hasNotifyPermission());
    setBatteryOk(isIgnoringBattery());
    setFullScreenOk(canUseFullScreenNotification());
    setExactAlarmOk(canUseExactAlarm());
  };

  // 检测原生桥（等待异步注入），拿到后刷新权限状态
  const detectBridge = async (ms: number) => {
    setBridgeState('checking');
    const b = await waitForBridge(ms);
    if (b) {
      setBridgeState('ready');
      refresh();
    } else {
      setBridgeState('missing');
    }
  };

  useEffect(() => {
    if (!native) return;
    refresh();
    detectBridge(8000);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => detectBridge(4000), 300);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, open]);

  // 安全调用：先确保桥就绪再执行原生方法，避免点击静默无反应
  const safeCall = async (fn: (b: any) => void) => {
    let b: any = await waitForBridge(3000);
    if (!b) b = await waitForBridge(8000);
    if (!b) {
      setBridgeState('missing');
      return;
    }
    setBridgeState('ready');
    try {
      fn(b);
    } catch {
      setBridgeState('missing');
    }
  };

  const afterAction = () => setTimeout(() => detectBridge(2000), 1200);

  const toggleEnabled = async (on: boolean) => {
    if (on) {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        const ok = await startCollectMonitor(token);
        if (!ok) setBridgeState('missing');
      }
    } else {
      await stopCollectMonitor();
    }
    setTimeout(() => detectBridge(2000), 500);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 active:bg-gray-50"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
          <BellRing className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-base text-gray-900">收款提醒设置</div>
          <div className="text-xs text-gray-400">
            {native
              ? enabled
                ? '已开启：有人付款时女声+震动+通知提醒'
                : '已关闭：点击开启收款提醒'
              : '女声+震动提醒请在 AI快卖 App 内使用'}
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          {!native && (
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 mb-1">
              <p className="text-sm font-semibold text-rose-700 mb-1.5">
                未检测到原生运行环境
              </p>
              <p className="text-xs text-rose-700 leading-relaxed mb-2">
                收款提醒（女声+震动+锁屏通知）仅在 AI快卖 App 内可用。若你已在 App
                内仍看到本提示，请更新到最新版或重新安装，并可截图本页发给管理员。
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed break-all">
                环境诊断｜Capacitor：{diag.hasCap ? '有' : '无'}；platform：
                {String(diag.capPlatform)}；isNativePlatform 类型：
                {diag.isNativeFnType}；isNative：{String(diag.isNativeProp)}；AppUpdate
                桥：{diag.hasAppUpdate ? '有' : '无'}；NativeHttp 桥：
                {diag.hasNativeHttp ? '有' : '无'}
              </p>
            </div>
          )}
          {native && (
          <>
          {/* 桥状态：加载中 */}
          {bridgeState === 'checking' && (
            <div className="mb-2 bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs text-gray-500 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
              正在加载收款模块，请稍候…
            </div>
          )}
          {/* 桥状态：缺失，给出明确处理入口与诊断 */}
          {bridgeState === 'missing' && (
            <div className="mb-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 mb-1">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                收款模块加载异常
              </div>
              <p className="text-xs text-rose-700 leading-relaxed mb-2">
                原生收款接口未就绪。请点下方按钮重新加载页面；若多次重试仍异常，请截图本卡片联系管理员处理。
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 bg-rose-500 active:bg-rose-600 text-white text-xs rounded-lg font-medium"
              >
                重新加载页面
              </button>
              <p className="mt-2 text-[10px] text-gray-500 break-all leading-relaxed">
                诊断｜Capacitor：{String(!!win.Capacitor)}；更新桥：
                {String(!!win.AppUpdate)}；网络桥：{String(!!win.NativeHttp)}；权限桥：
                {String(!!win.NativePermission)}；收款桥：{String(!!win.CollectMonitor)}
              </p>
            </div>
          )}

          {/* 总开关 */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                <Bell className="h-4 w-4 text-orange-500" />
              </div>
              <span className="text-sm text-gray-800">启用收款提醒</span>
            </div>
            <button
              onClick={() => toggleEnabled(!enabled)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                enabled ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${
                  enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* 试听 */}
          <div className="flex items-center gap-3 py-2.5 border-b border-gray-100">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
              <Volume2 className="h-4 w-4 text-orange-500" />
            </div>
            <span className="text-sm text-gray-800 flex-1">试听提醒铃声</span>
            <button
              onClick={() => safeCall((b) => b.playTest())}
              className="text-xs bg-orange-50 border border-orange-200 active:bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg font-medium"
            >
              播放
            </button>
          </div>

          {/* 权限 1：通知 */}
          <PermissionRow
            icon={<Bell className="h-4 w-4 text-orange-500" />}
            title="允许通知（锁屏弹窗+铃声）"
            ok={notifyOk}
            actionLabel="去开启"
            onAction={() => { safeCall((b) => b.requestNotifyPermission()); afterAction(); }}
          />

          {/* 权限 2：电池优化白名单 */}
          <PermissionRow
            icon={<BatteryCharging className="h-4 w-4 text-orange-500" />}
            title="关闭电池优化（后台不被杀死）"
            ok={batteryOk}
            actionLabel="去开启"
            onAction={() => { safeCall((b) => b.requestIgnoreBattery()); afterAction(); }}
          />

          {/* 权限 3：自启动 */}
          <div className="flex items-center gap-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Zap className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-800">允许开机自启动</div>
              <div className="text-xs text-gray-400">小米/华为/OPPO/vivo 需手动允许</div>
            </div>
            <button
              onClick={() => safeCall((b) => b.openAutoStart())}
              className="text-xs bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
            >
              去设置
            </button>
          </div>

          {/* 权限 4：锁屏全屏弹窗（安卓14） */}
          <PermissionRow
            icon={<Maximize className="h-4 w-4 text-orange-500" />}
            title="锁屏全屏弹窗（安卓14）"
            ok={fullScreenOk}
            actionLabel="去开启"
            onAction={() => { safeCall((b) => b.requestFullScreen()); afterAction(); }}
          />

          {/* 权限 5：定时唤醒（安卓12以上） */}
          <PermissionRow
            icon={<AlarmClock className="h-4 w-4 text-orange-500" />}
            title="允许定时唤醒（安卓12以上）"
            ok={exactAlarmOk}
            actionLabel="去开启"
            onAction={() => { safeCall((b) => b.requestExactAlarm()); afterAction(); }}
          />

          <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              为保证锁屏、后台或重启后仍能及时提醒您收款，请将以上权限逐项全部开启（安卓12以上还需允许定时唤醒、安卓14还需允许锁屏全屏弹窗）；开机后服务会自动运行。
            </p>
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}
