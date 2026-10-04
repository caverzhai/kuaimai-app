import { useEffect, useRef, useState } from 'react';
import { getPendingNotifications } from '../api';
import { isNativeApp } from '../utils/collectReminder';

const SEQ_KEY = 'last_notif_seq';
const POLL_INTERVAL = 40000; // 每40秒轻量轮询一次
const STREAM_BASE = 'https://backend-production-5d79.up.railway.app';
const COLLECT_AUTOCLOSE_MS = 200_000; // 收款弹窗兜底：订单180秒自动确认后，弹窗自动关闭

interface AppNotification {
  id: string;
  seq: number;
  userId: string | null;
  title: string;
  body: string;
  type: 'system' | 'update' | 'collect';
  payload: Record<string, any> | null;
  silent?: boolean; // collect：订单已离开待收款窗口（待发货/服务中），静默、不响不弹
  createdAt: any;
}

// 全局系统通知监听：启动/回前台/定时轮询拉取；前台弹窗，后台用本地通知栏
export default function GlobalNotificationListener() {
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const activeRef = useRef(true);
  const seqRef = useRef(0);
  const localIdRef = useRef(1);
  // 已展示过（在栏或已手动关闭），保证同一收款单不重复弹
  const shownIdsRef = useRef<Set<string>>(new Set());
  const autoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 出队：清计时器 + 移除弹窗；保留 shownIds（不再重复弹），且不 ack
  // （收款单由服务端持续跟踪到订单终态，才能在发货/完成时准确收尾）
  const removeFromQueue = (id: string) => {
    const t = autoTimersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      autoTimersRef.current.delete(id);
    }
    setQueue((q) => q.filter((x) => x.id !== id));
  };

  // collect 入队（仅 live 待收款单），并安排兜底自动关闭
  const enqueueCollect = (n: AppNotification) => {
    if (shownIdsRef.current.has(n.id)) return;
    shownIdsRef.current.add(n.id);
    setQueue((q) => [...q, n]);
    const t = setTimeout(() => {
      // 超过收款窗口仍未处理：订单已自动确认/推进，弹窗自动关闭
      removeFromQueue(n.id);
    }, COLLECT_AUTOCLOSE_MS);
    autoTimersRef.current.set(n.id, t);
  };

  useEffect(() => {
    let cancelled = false;

    try {
      seqRef.current = parseInt(localStorage.getItem(SEQ_KEY) || '0', 10) || 0;
    } catch {
      seqRef.current = 0;
    }

    // 后台/锁屏：弹本地通知栏（@capacitor/local-notifications）
    const scheduleLocal = async (n: AppNotification) => {
      try {
        const mod = await import('@capacitor/local-notifications');
        const cur = await mod.LocalNotifications.checkPermissions();
        let granted = cur.display === 'granted';
        if (!granted) {
          const req = await mod.LocalNotifications.requestPermissions();
          granted = req.display === 'granted';
        }
        if (!granted) return;
        const id = localIdRef.current++ % 2000000000;
        await mod.LocalNotifications.schedule({
          notifications: [{ id, title: n.title, body: n.body }],
        });
      } catch {
        // H5 或插件不可用，忽略
      }
    };

    // 按前后台与类型路由
    const route = (list: AppNotification[]) => {
      const sysList: AppNotification[] = [];
      let updateDispatched = false;
      list.forEach((n) => {
        if (n.type === 'collect') {
          // 原生 App：收款全交 CollectMonitor 前台服务（女声+震动+系统通知）
          if (isNativeApp()) return;
          // H5：silent（待发货/服务中）不弹窗；live 且在前台才弹窗
          if (n.silent) return;
          if (activeRef.current) enqueueCollect(n);
          return;
        }
        if (n.type === 'update') {
          if (activeRef.current) {
            if (!updateDispatched) {
              updateDispatched = true;
              window.dispatchEvent(new Event('app:force-update-check'));
            }
          } else {
            scheduleLocal(n);
          }
        } else if (activeRef.current) {
          sysList.push(n);
        } else {
          scheduleLocal(n);
        }
      });
      if (sysList.length) {
        setQueue((q) => {
          const ex = new Set(q.map((x) => x.id));
          const add = sysList.filter((x) => !ex.has(x.id));
          return add.length ? [...q, ...add] : q;
        });
      }
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await getPendingNotifications(seqRef.current);
        const list: AppNotification[] = Array.isArray(data.notifications)
          ? data.notifications
          : [];
        if (list.length) {
          const maxSeq = list.reduce(
            (m, n) => Math.max(m, Number(n.seq) || 0),
            seqRef.current,
          );
          seqRef.current = maxSeq;
          try {
            localStorage.setItem(SEQ_KEY, String(maxSeq));
          } catch {
            // ignore
          }
        }
        // 以服务端当前 live（待收款）集合校准：已转待发货/完成/取消的收款弹窗自动关闭
        const liveIds = new Set(
          list.filter((x) => x.type === 'collect' && !x.silent).map((x) => x.id),
        );
        setQueue((q) => {
          const stale = q.filter((x) => x.type === 'collect' && !liveIds.has(x.id));
          if (!stale.length) return q;
          stale.forEach((x) => {
            const t = autoTimersRef.current.get(x.id);
            if (t) {
              clearTimeout(t);
              autoTimersRef.current.delete(x.id);
            }
          });
          return q.filter((x) => !(x.type === 'collect' && !liveIds.has(x.id)));
        });
        if (list.length) route(list);
      } catch {
        // 未登录(401)或网络异常，静默，下次再试
      }
    };

    const startTimer = setTimeout(poll, 2500);
    const pollTimer = setInterval(poll, POLL_INTERVAL);

    // ── SSE 实时通道：前台收款 0 延迟 ──
    const processedIds = new Set<string>();
    const handleRealtime = (n: AppNotification) => {
      if (!n || !n.id || processedIds.has(n.id)) return;
      processedIds.add(n.id);
      const s = Number(n.seq) || 0;
      if (s > seqRef.current) {
        seqRef.current = s;
        try {
          localStorage.setItem(SEQ_KEY, String(s));
        } catch {
          // ignore
        }
      }
      if (isNativeApp()) {
        try {
          (window as any).CollectMonitor?.showNow(JSON.stringify(n));
        } catch {
          // ignore
        }
      } else if (activeRef.current && !n.silent) {
        enqueueCollect(n);
      }
      // 不 ack：服务端跟踪到订单终态才自动确认
    };

    let es: EventSource | null = null;
    let esRetry: ReturnType<typeof setTimeout> | null = null;
    const connectStream = () => {
      if (es) return;
      const token = localStorage.getItem('kuaimai_token');
      if (!token) {
        esRetry = setTimeout(connectStream, 5000);
        return;
      }
      try {
        es = new EventSource(
          `${STREAM_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`,
        );
        es.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data);
            if (d?.type === 'collect' && d.notification) {
              handleRealtime(d.notification as AppNotification);
            }
          } catch {
            // ignore
          }
        };
        es.onerror = () => {
          if (!localStorage.getItem('kuaimai_token')) {
            es?.close();
            es = null;
          }
        };
      } catch {
        es = null;
        esRetry = setTimeout(connectStream, 5000);
      }
    };
    const streamTimer = setTimeout(connectStream, 3000);

    // 回前台立即拉取
    let appStateSub: { remove: () => void } | null = null;
    (async () => {
      try {
        const app = await import('@capacitor/app');
        appStateSub = await app.App.addListener('appStateChange', ({ isActive }) => {
          activeRef.current = isActive;
          if (isActive) {
            poll();
            connectStream();
          }
        });
      } catch {
        // H5，使用 visibilitychange 兜底
      }
    })();

    const onVisible = () => {
      activeRef.current = document.visibilityState === 'visible';
      if (activeRef.current) {
        poll();
        connectStream();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(streamTimer);
      if (esRetry) clearTimeout(esRetry);
      if (es) es.close();
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisible);
      if (appStateSub) appStateSub.remove();
      autoTimersRef.current.forEach((t) => clearTimeout(t));
      autoTimersRef.current.clear();
    };
  }, []);

  const current = queue[0] || null;
  const closeCurrent = () => {
    const cur = queue[0];
    if (!cur) return;
    if (cur.type === 'collect') removeFromQueue(cur.id);
    else setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '28px 22px',
          maxWidth: '380px',
          width: '100%',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#1a1a1a' }}>
          {current.title}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: '#666',
            lineHeight: 1.7,
            marginBottom: '22px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {current.body}
        </p>
        <button
          onClick={closeCurrent}
          style={{
            width: '100%',
            padding: '13px',
            backgroundColor: '#f97316',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 'bold',
          }}
        >
          我知道了
        </button>
      </div>
    </div>
  );
}
