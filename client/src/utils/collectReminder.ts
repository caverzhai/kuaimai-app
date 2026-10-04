// 收款提醒（原生前台服务）桥接封装
// 原生 CollectMonitorService 通过 addJavascriptInterface 注入 window.CollectMonitor

declare global {
  interface Window {
    CollectMonitor?: {
      start: (token: string) => void;
      stop: () => void;
      clearAlerts: () => void;
      isEnabled: () => boolean;
      playTest: () => void;
      hasNotifyPermission: () => boolean;
      requestNotifyPermission: () => void;
      isIgnoringBattery: () => boolean;
      requestIgnoreBattery: () => void;
      openAutoStart: () => void;
      canUseFullScreen: () => boolean;
      requestFullScreen: () => void;
      canScheduleExactAlarm: () => boolean;
      requestExactAlarm: () => void;
    };
  }
}

export function isNativeApp(): boolean {
  try {
    const cap = (window as any).Capacitor;
    if (cap) {
      // Capacitor：isNativePlatform 是函数，isNative 才是布尔属性
      if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
      if (cap.isNative === true) return true;
      if (typeof cap.platform === 'string' && cap.platform !== 'web') return true;
    }
    // 本 App 自定义原生桥（addJavascriptInterface 注入）
    if ((window as any).AppUpdate || (window as any).NativeHttp) return true;
    return false;
  } catch {
    return false;
  }
}

function bridge(): Window['CollectMonitor'] | null {
  try {
    return window.CollectMonitor ?? null;
  } catch {
    return null;
  }
}

// 等待桥注入（原生接口在 WebView 初始化后异步注入），最多 waitMs
export async function waitForBridge(waitMs = 6000): Promise<NonNullable<Window['CollectMonitor']> | null> {
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    const b = bridge();
    if (b && typeof b.start === 'function') return b;
    await new Promise((r) => setTimeout(r, 200));
  }
  return bridge();
}

// 登录后启动前台服务（含 token）
export async function startCollectMonitor(token: string): Promise<boolean> {
  if (!isNativeApp() || !token) return false;
  const b = await waitForBridge();
  if (!b) return false;
  try {
    b.start(token);
    return true;
  } catch {
    return false;
  }
}

// 登出时停止
export async function stopCollectMonitor(): Promise<void> {
  if (!isNativeApp()) return;
  const b = await waitForBridge(2000);
  try {
    b?.stop();
  } catch {
    // ignore
  }
}

// 回到前台：清除聚合通知与角标（用户已进入 App）
export function clearCollectAlerts(): void {
  if (!isNativeApp()) return;
  try {
    bridge()?.clearAlerts();
  } catch {
    // ignore
  }
}

export function isCollectEnabled(): boolean {
  try {
    return bridge()?.isEnabled() === true;
  } catch {
    return false;
  }
}

// 试听铃声
export function playCollectTest(): void {
  try {
    bridge()?.playTest();
  } catch {
    // ignore
  }
}

// ---- 权限 ----
export function hasNotifyPermission(): boolean {
  if (!isNativeApp()) return true;
  try {
    return bridge()?.hasNotifyPermission() === true;
  } catch {
    return true;
  }
}

export function requestNotifyPermission(): void {
  try {
    bridge()?.requestNotifyPermission();
  } catch {
    // ignore
  }
}

export function isIgnoringBattery(): boolean {
  if (!isNativeApp()) return true;
  try {
    return bridge()?.isIgnoringBattery() === true;
  } catch {
    return true;
  }
}

export function requestIgnoreBattery(): void {
  try {
    bridge()?.requestIgnoreBattery();
  } catch {
    // ignore
  }
}

export function openAutoStartSettings(): void {
  try {
    bridge()?.openAutoStart();
  } catch {
    // ignore
  }
}

// 全屏通知（Android14+）：锁屏直接全屏弹出
export function canUseFullScreenNotification(): boolean {
  if (!isNativeApp()) return true;
  try {
    return bridge()?.canUseFullScreen() === true;
  } catch {
    return true;
  }
}

export function requestFullScreenNotification(): void {
  try {
    bridge()?.requestFullScreen();
  } catch {
    // ignore
  }
}

// 精确闹钟（Android12+）：Doze 下也能定时唤醒轮询
export function canUseExactAlarm(): boolean {
  if (!isNativeApp()) return true;
  try {
    return bridge()?.canScheduleExactAlarm() === true;
  } catch {
    return true;
  }
}

export function requestExactAlarm(): void {
  try {
    bridge()?.requestExactAlarm();
  } catch {
    // ignore
  }
}
