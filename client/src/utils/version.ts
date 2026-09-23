// APP version config
export const APP_VERSION = '2.34.6';
export const APP_VERSION_CODE = 144;

// Version check URL (deployed to backend static file)
export const VERSION_CHECK_URL = 'https://backend-production-5d79.up.railway.app/version.json';

export interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
}

// Native APP update interface type declaration
declare global {
  interface Window {
    AppUpdate?: {
      downloadAndInstall: (apkUrl: string, versionName: string) => string;
      getCurrentVersion: () => string;
    };
  }
}

// Get current APP version (prefer native, fallback to frontend config)
export function getCurrentVersion(): { versionName: string; versionCode: number } {
  try {
    if (window.AppUpdate && typeof window.AppUpdate.getCurrentVersion === 'function') {
      const result = JSON.parse(window.AppUpdate.getCurrentVersion());
      if (result.versionName && result.versionCode > 0) {
        return result;
      }
    }
  } catch (error) {
    console.error('Failed to get native version', error);
  }
  return { versionName: APP_VERSION, versionCode: APP_VERSION_CODE };
}

// Check update (only in native APP environment, H5 web version does not check)
export async function checkUpdate(): Promise<VersionInfo | null> {
  // H5 web environment does not check APP update, avoid infinite loop
  const isNativeApp = (window as any).Capacitor?.isNativePlatform === true || !!window.AppUpdate;
  if (!isNativeApp) {
    return null;
  }
  try {
    const currentVersion = getCurrentVersion();
    const response = await fetch(VERSION_CHECK_URL, { cache: 'no-cache' });
    if (!response.ok) return null;
    const data = (await response.json()) as VersionInfo;
    if (data.versionCode > currentVersion.versionCode) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to check update', error);
    return null;
  }
}

// Download and install update
export function downloadAndInstall(versionInfo: VersionInfo): boolean {
  try {
    // 1) 原生 APP：优先调用 AppUpdateBridge（DownloadManager 下载 + 系统安装器）
    if (window.AppUpdate && typeof window.AppUpdate.downloadAndInstall === 'function') {
      try {
        const result = JSON.parse(
          window.AppUpdate.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version)
        );
        if (result.success === true) return true;
        // 原生返回需要先授予"安装未知应用"权限时，已自动跳转设置页，视为已处理
        if (result.message && String(result.message).includes('未知应用')) {
          return true;
        }
        console.warn('原生更新未成功启动:', result.message);
        return false;
      } catch (nativeErr) {
        console.error('原生下载调用异常，尝试等待注入/降级:', nativeErr);
      }
    }

    // 2) Capacitor 环境但桥尚未注入：轮询等待（最多 3 秒），仍失败则用系统浏览器打开
    if ((window as any).Capacitor) {
      let waitCount = 0;
      const waitForInject = setInterval(() => {
        waitCount++;
        if (window.AppUpdate && typeof window.AppUpdate.downloadAndInstall === 'function') {
          clearInterval(waitForInject);
          try {
            window.AppUpdate.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version);
          } catch {
            window.open(versionInfo.downloadUrl, '_system');
          }
        } else if (waitCount > 10) {
          clearInterval(waitForInject);
          // 注入超时，降级到系统浏览器下载
          window.open(versionInfo.downloadUrl, '_system');
        }
      }, 300);
      return true;
    }

    // 3) 纯 Web 环境：新窗口打开下载链接
    window.open(versionInfo.downloadUrl, '_blank');
    return true;
  } catch (error) {
    console.error('Failed to download update', error);
    // 最终兜底：直接跳转
    window.location.href = versionInfo.downloadUrl;
    return true;
  }
}

