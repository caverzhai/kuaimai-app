import { useEffect, useState } from 'react';
import { checkUpdate, downloadAndInstall, type VersionInfo } from '../utils/version';

export default function GlobalUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [tip, setTip] = useState('');

  useEffect(() => {
    // 只在 native APP 环境下检查更新，H5 网页版不检查
    const isNativeApp =
      (window as any).Capacitor?.isNativePlatform === true || !!(window as any).AppUpdate;
    if (!isNativeApp) return;

    // 延迟 2 秒检查，等待原生桥注入完成
    const timer = setTimeout(async () => {
      try {
        const info = await checkUpdate();
        if (info) {
          setUpdateInfo(info);
          setShowUpdateModal(true);
        }
      } catch (e) {
        console.error('检查更新失败', e);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = () => {
    if (!updateInfo || downloading) return;
    setDownloading(true);
    setTip('正在下载更新，下载完成后会自动弹出安装，请稍候…');
    // 必须走安卓原生下载安装桥（DownloadManager + 系统安装器），
    // 不能用 window.location.href，否则 WebView 只会导航到 apk 而无法安装
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
