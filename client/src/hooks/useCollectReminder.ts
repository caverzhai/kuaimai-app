import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  isNativeApp,
  isCollectEnabled,
  startCollectMonitor,
  stopCollectMonitor,
  clearCollectAlerts,
} from '../utils/collectReminder';

const TOKEN_KEY = 'kuaimai_token';
const HEARTBEAT_MS = 45_000;

/**
 * 收款提醒生命周期（原生 App）：
 * - 登录：用当前 token 启动前台服务（默认开启，幂等）
 * - 登出 / 无用户：停止服务
 * - 回到前台：先自愈（服务若被系统杀掉 / 切号时停掉则重新拉起），再清聚合弹窗
 * - 定时心跳：每 45s 检查，服务意外停止时自动拉起
 * - 用户在设置里主动关闭（KEY_ENABLED=false）后，自愈与心跳不会强行拉起
 */
export function useCollectReminder(): void {
  const { user } = useAuth();

  // 登录 / 登出 / 切号
  useEffect(() => {
    if (!isNativeApp()) return;
    if (user) {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) void startCollectMonitor(token);
    } else {
      void stopCollectMonitor();
    }
  }, [user]);

  // 回前台自愈 + 定时心跳
  useEffect(() => {
    if (!isNativeApp()) return;
    let sub: { remove: () => void } | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    // 仅在用户已开启（未主动关闭）时自愈；start 幂等，重复调用只更新 token 并立即轮询
    const selfHeal = () => {
      if (!isCollectEnabled()) return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) void startCollectMonitor(token);
    };

    (async () => {
      try {
        const mod = await import('@capacitor/app');
        sub = await mod.App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            setTimeout(selfHeal, 600); // 等桥就绪后自愈
            setTimeout(() => clearCollectAlerts(), 1200); // 用户已在 App 内，清聚合弹窗（角标由轮询按真实待收款校准）
          }
        });
      } catch {
        // H5：忽略
      }
      heartbeat = setInterval(selfHeal, HEARTBEAT_MS);
    })();

    return () => {
      sub?.remove();
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [user]);
}
