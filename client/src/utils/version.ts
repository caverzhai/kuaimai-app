// APP version config
export const APP_VERSION = '3.4.0';
export const APP_VERSION_CODE = 340;

// Version check URL (deployed to backend static file)
export const VERSION_CHECK_URL = 'https://backend-production-5d79.up.railway.app/version.json';

export interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  forceUpdateBelowCode?: number;
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
      const code = Number(result.versionCode);
      if (result.versionName && Number.isInteger(code) && code > 0) {
        return { versionName: result.versionName, versionCode: code };
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
  const cap = (window as any).Capacitor;
  const isNativeApp =
    (typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()) ||
    cap?.isNative === true ||
    !!window.AppUpdate;
  if (!isNativeApp) {
    return null;
  }
  try {
    const currentVersion = getCurrentVersion();
    const checkUrl =
      VERSION_CHECK_URL + (VERSION_CHECK_URL.includes('?') ? '&' : '?') + 't=' + Date.now();
    const response = await fetch(checkUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as VersionInfo;
    const hasUpdate =
      data.versionCode > currentVersion.versionCode ||
      (typeof data.forceUpdateBelowCode === 'number' &&
        currentVersion.versionCode < data.forceUpdateBelowCode);
    if (hasUpdate) {
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
    // 防缓存：给下载地址追加版本号参数，保证每个新版本的下载 URL 唯一，
    // 避免浏览器 / DownloadManager 复用同名旧 APK（这是"装完还是旧版"死循环的根因）。
    versionInfo.downloadUrl =
      versionInfo.downloadUrl +
      (versionInfo.downloadUrl.includes('?') ? '&' : '?') +
      'v=' + versionInfo.versionCode;

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

// Force download latest version (bypasses version comparison)
export async function forceDownloadLatest(): Promise<boolean> {
  try {
    const checkUrl =
      VERSION_CHECK_URL + (VERSION_CHECK_URL.includes('?') ? '&' : '?') + 't=' + Date.now();
    const response = await fetch(checkUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('version.json HTTP ' + response.status);
    const data = (await response.json()) as VersionInfo;
    return downloadAndInstall(data);
  } catch (error) {
    console.error('forceDownloadLatest failed', error);
    return false;
  }
}
