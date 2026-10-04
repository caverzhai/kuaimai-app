import { useEffect, useState } from 'react';
import { checkUpdate, downloadAndInstall, type VersionInfo } from '../utils/version';

export default function GlobalUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [tip, setTip] = useState('');

  useEffect(() => {
    let cancelled = false;
    let found = false; // 一旦检测到更新即停止自动检查，交给用户处理弹窗
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.push(t);
      return t;
    };

    const runCheck = async () => {
      if (cancelled || found) return;
      const cap = (window as any).Capacitor;
      const isNative =
        (typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()) ||
        cap?.isNative === true ||
        (window.AppUpdate && typeof window.AppUpdate.getCurrentVersion === 'function');
      if (!isNative) return;
      try {
        const info = await checkUpdate();
        if (info && !cancelled && !found) {
          found = true;
          setUpdateInfo(info);
          setShowUpdateModal(true);
        }
      } catch (e) {
        console.error('检查更新失败', e);
      }
    };

    // 回前台：延迟1.5s检查（等网络/桥就绪），若未发现更新，5.5s再补查一次
    const handleResume = () => {
      if (cancelled || found) return;
      later(runCheck, 1500);
      later(runCheck, 5500);
    };

    // 启动即检查（不依赖自定义原生桥；纯 Capacitor 也能检测，下载时系统浏览器兜底）
    runCheck();
    later(runCheck, 3000);
    later(runCheck, 8000);
    later(runCheck, 20000);
    later(runCheck, 45000);

    // 原生桥若注入再补查（桥就绪后可走原生 DownloadManager 最佳路径）
    let pollCount = 0;
    const pollTimer = setInterval(() => {
      if (cancelled) {
        clearInterval(pollTimer);
        return;
      }
      pollCount++;
      if (window.AppUpdate && typeof window.AppUpdate.getCurrentVersion === 'function') {
        clearInterval(pollTimer);
        runCheck();
        return;
      }
      if (pollCount >= 60) clearInterval(pollTimer);
    }, 500);
    intervals.push(pollTimer);

    // 常驻轮询：每60秒检查一次（启动桥等待超时也会在桥就绪后于此查到）
    const residentTimer = setInterval(runCheck, 60000);
    intervals.push(residentTimer);

    // App 从后台回到前台时重新检测（覆盖多任务切换、进程常驻不杀的场景）
    let appStateSub: { remove: () => void } | null = null;
    (async () => {
      try {
        const mod = await import('@capacitor/app');
        if (cancelled) return;
        appStateSub = await mod.App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) handleResume();
        });
      } catch (e) {
        console.warn('Capacitor App 插件不可用，使用 visibilitychange 兜底', e);
      }
    })();

    // 兜底：页面重新可见时检测
    const onVisible = () => {
      if (document.visibilityState === 'visible') handleResume();
    };
    document.addEventListener('visibilitychange', onVisible);
    // 收到“版本更新”系统通知时，主动触发一次更新检查并弹窗
    window.addEventListener('app:force-update-check', runCheck);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('app:force-update-check', runCheck);
      if (appStateSub && typeof appStateSub.remove === 'function') appStateSub.remove();
    };
  }, []);

  const handleUpdate = () => {
    if (!updateInfo || downloading) return;
    setDownloading(true);
    setTip('正在下载更新，下载完成后会自动弹出安装，请稍候…');
    const ok = downloadAndInstall(updateInfo);
    if (!ok) {
      setTip('下载启动失败，请稍后在「我的-检查更新」重试，或用浏览器手动下载。');
      setDownloading(false);
    }
  };

  if (!showUpdateModal || !updateInfo) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 99999,
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
          padding: '32px 24px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#1a1a1a' }}>
          发现新版本
        </h2>
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
          版本 {updateInfo.version}
        </p>
        <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px', lineHeight: 1.6 }}>
          {updateInfo.releaseNotes || '修复了一些问题，提升了体验'}
        </p>
        <button
          onClick={handleUpdate}
          disabled={downloading}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: downloading ? '#fbbd8a' : '#f97316',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: downloading ? 'default' : 'pointer',
          }}
        >
          {downloading ? '正在下载更新…' : '立即更新'}
        </button>
        {tip && (
          <p style={{ fontSize: '12px', color: '#f97316', marginTop: '12px', lineHeight: 1.5 }}>
            {tip}
          </p>
        )}
        {!updateInfo.forceUpdate && (
          <button
            onClick={() => setShowUpdateModal(false)}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'transparent',
              color: '#999',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              marginTop: '8px',
              cursor: 'pointer',
            }}
          >
            稍后再说
          </button>
        )}
      </div>
    </div>
  );
}
