// APP version config
export const APP_VERSION = '2.31.0';
export const APP_VERSION_CODE = 135;

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
    // If AppUpdate interface is injected, call directly
    if (window.AppUpdate && typeof window.AppUpdate.downloadAndInstall === 'function') {
      const result = JSON.parse(
        window.AppUpdate.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version)
      );
      if (result.success === true) return true;
    }
    // APP environment but interface not injected: poll wait for injection (max 3 seconds)
    if ((window as any).Capacitor) {
      let waitCount = 0;
      const waitForInject = setInterval(() => {
        waitCount++;
        if (window.AppUpdate && typeof window.AppUpdate.downloadAndInstall === 'function') {
          clearInterval(waitForInject);
          window.AppUpdate.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version);
        } else if (waitCount > 10) {
          clearInterval(waitForInject);
          // Injection timeout, fallback to system browser
          window.open(versionInfo.downloadUrl, '_system');
        }
      }, 300);
      return true;
    }
    // Web environment, open download link
    window.open(versionInfo.downloadUrl, '_blank');
    return true;
  } catch (error) {
    console.error('Failed to download update', error);
    // Fallback: direct redirect
    window.location.href = versionInfo.downloadUrl;
    return true;
  }
}

