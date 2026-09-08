// APP 版本配置
export const APP_VERSION = '2.17.0';
export const APP_VERSION_CODE = 82;

// 版本信息接口地址（部署到后端静态文件）
export const VERSION_CHECK_URL = 'https://backend-production-5d79.up.railway.app/version.json';

export interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
}

// 原生 APP 更新接口类型声明
declare global {
  interface Window {
    AppUpdate?: {
      downloadAndInstall: (apkUrl: string, versionName: string) => string;
      getCurrentVersion: () => string;
    };
  }
}

// 获取当前 APP 版本（优先使用原生获取，降级使用前端配置）
export function getCurrentVersion(): { versionName: string; versionCode: number } {
  try {
    if (window.AppUpdate && typeof window.AppUpdate.getCurrentVersion === 'function') {
      const result = JSON.parse(window.AppUpdate.getCurrentVersion());
      if (result.versionName && result.versionCode > 0) {
        return result;
      }
    }
  } catch (error) {
    console.error('获取原生版本号失败', error);
  }
  return { versionName: APP_VERSION, versionCode: APP_VERSION_CODE };
}

// 检查更新
export async function checkUpdate(): Promise<VersionInfo | null> {
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
    console.error('检查更新失败', error);
    return null;
  }
}

// 下载并安装更新
export function downloadAndInstall(versionInfo: VersionInfo): boolean {
  try {
    if (window.AppUpdate && typeof window.AppUpdate.downloadAndInstall === 'function') {
      const result = JSON.parse(
        window.AppUpdate.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version)
      );
      return result.success === true;
    }
    // 非 APP 环境，打开下载链接
    window.open(versionInfo.downloadUrl, '_blank');
    return true;
  } catch (error) {
    console.error('下载更新失败', error);
    return false;
  }
}

