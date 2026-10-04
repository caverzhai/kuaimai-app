import { useEffect, useRef } from 'react';

interface UseVisiblePollingOptions {
  /** 前台轮询间隔（毫秒）；后台自动暂停 */
  intervalMs: number;
  /** 轮询回调（可为 async，异常会被吞掉，避免未捕获报错） */
  onPoll: () => unknown;
  /** 页面/APP 回到前台时是否立即触发一次，默认 true */
  immediateOnVisible?: boolean;
  /** 回前台触发的延迟（毫秒），避免与其他启动请求竞争，默认 0 */
  visibleDelayMs?: number;
  /** 是否启用，默认 true */
  enabled?: boolean;
  /** 相邻两次触发的最小间隔（毫秒），用于 visibility 与 appState 重复事件去重，默认 2000 */
  dedupMs?: number;
}

/**
 * 统一的“可见性轮询”：
 * - 仅在页面可见（前台）时按 intervalMs 轮询，后台不消耗资源；
 * - 页面 visibilitychange 或 Capacitor appStateChange 回到前台时，立即（可配延迟）触发一次；
 * - 重复事件用 dedupMs 节流，避免重复请求。
 */
export function useVisiblePolling({
  intervalMs,
  onPoll,
  immediateOnVisible = true,
  visibleDelayMs = 0,
  enabled = true,
  dedupMs = 2000,
}: UseVisiblePollingOptions) {
  const cbRef = useRef(onPoll);
  cbRef.current = onPoll;
  const lastFireRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fire = (delay: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const now = Date.now();
        if (now - lastFireRef.current < dedupMs) return;
        lastFireRef.current = now;
        try {
          const r = cbRef.current() as Promise<void> | void;
          if (r && typeof (r as Promise<void>).catch === 'function') {
            (r as Promise<void>).catch(() => {});
          }
        } catch {
          /* 忽略轮询异常 */
        }
      }, delay);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && immediateOnVisible) {
        fire(visibleDelayMs);
      }
    };

    // 前台定时轮询（回调内再次判断可见性，双保险）
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fire(0);
    }, intervalMs);

    document.addEventListener('visibilitychange', onVisibility);

    // Capacitor 原生 APP 前后台切换（部分机型 visibilitychange 不触发时兜底）
    let cancelled = false;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const mod = await import('@capacitor/app');
        if (cancelled) return;
        sub = await mod.App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && immediateOnVisible) fire(visibleDelayMs);
        });
      } catch {
        /* 非 Capacitor 环境忽略 */
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      if (sub) sub.remove();
    };
  }, [enabled, intervalMs, immediateOnVisible, visibleDelayMs, dedupMs]);
}
