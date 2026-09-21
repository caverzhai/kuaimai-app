import { useEffect, useState } from 'react';

const VERSION_CHECK_URL = 'https://backend-production-5d79.up.railway.app/version.json';
const CURRENT_VERSION_CODE = 128; // 2.28.5

interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
}

export default function GlobalUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // APP启动时立即检查更新（不依赖登录，不依赖native检测）
    const doCheck = async () => {
      try {
        const response = await fetch(VERSION_CHECK_URL + '?nocache=' + Date.now(), { cache: 'no-cache' });
        if (!response.ok) return;
        const data = await response.json();
        // 服务器版本高于当前版本就提示更新
        if (data.versionCode > CURRENT_VERSION_CODE) {
          setUpdateInfo(data);
          setShowUpdateModal(true);
        }
      } catch (e) {
        console.error('检查更新失败', e);
      }
    };
    doCheck();
  }, []);

  const handleUpdate = () => {
    if (!updateInfo) return;
    // 直接打开下载链接
    window.location.href = updateInfo.downloadUrl;
  };

  if (!showUpdateModal || !updateInfo) return null;

  return (
    <div style={{
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
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '32px 24px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#1a1a1a' }}>
          发现新版本
        </h2>
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
          版本 {updateInfo.version}
        </p>
        <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px', lineHeight: '1.6' }}>
          {updateInfo.releaseNotes || '修复了一些问题，提升了体验'}
        </p>
        <button
          onClick={handleUpdate}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#f97316',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          立即更新
        </button>
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
