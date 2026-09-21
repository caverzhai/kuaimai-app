// APP 鐗堟湰閰嶇疆
export const APP_VERSION = '2.28.2';
export const APP_VERSION_CODE = 123;

// 鐗堟湰淇℃伅鎺ュ彛鍦板潃锛堥儴缃插埌鍚庣闈欐€佹枃浠讹級
export const VERSION_CHECK_URL = 'https://backend-production-5d79.up.railway.app/version.json';

export interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
}

// 鍘熺敓 APP 鏇存柊鎺ュ彛绫诲瀷澹版槑
declare global {
  interface Window {
    AppUpdate?: {
      downloadAndInstall: (apkUrl: string, versionName: string) => string;
      getCurrentVersion: () => string;
    };
  }
}

// 鑾峰彇褰撳墠 APP 鐗堟湰锛堜紭鍏堜娇鐢ㄥ師鐢熻幏鍙栵紝闄嶇骇浣跨敤鍓嶇閰嶇疆锛?
export function getCurrentVersion(): { versionName: string; versionCode: number } {
  try {
    if (window.AppUpdate && typeof window.AppUpdate.getCurrentVersion === 'function') {
      const result = JSON.parse(window.AppUpdate.getCurrentVersion());
      if (result.versionName && result.versionCode > 0) {
        return result;
      }
    }
  } catch (error) {
    console.error('鑾峰彇鍘熺敓鐗堟湰鍙峰け璐?, error);
  }
  return { versionName: APP_VERSION, versionCode: APP_VERSION_CODE };
}

// 妫€鏌ユ洿鏂帮紙浠呭湪APP鐜涓嬫鏌ワ紝H5缃戦〉鐗堜笉妫€鏌PP鏇存柊锛?
export async function checkUpdate(): Promise<VersionInfo | null> {
  // H5缃戦〉鐜涓嶆鏌PP鏇存柊锛岄伩鍏嶆棤闄愬惊鐜彁绀?
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
    console.error('妫€鏌ユ洿鏂板け璐?, error);
    return null;
  }
}

// 涓嬭浇骞跺畨瑁呮洿鏂?
export function downloadAndInstall(versionInfo: VersionInfo): boolean {
  try {
    // 濡傛灉AppUpdate鎺ュ彛宸叉敞鍏ワ紝鐩存帴璋冪敤
    if (window.AppUpdate && typeof window.AppUpdate.downloadAndInstall === 'function') {
      const result = JSON.parse(
        window.AppUpdate.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version)
      );
      if (result.success === true) return true;
    }
    // APP鐜浣嗘帴鍙ｆ湭娉ㄥ叆锛氳疆璇㈢瓑寰呮敞鍏ワ紙鏈€澶氱瓑寰?绉掞級
    if ((window as any).Capacitor) {
      let waitCount = 0;
      const waitForInject = setInterval(() => {
        waitCount++;
        if (window.AppUpdate && typeof window.AppUpdate.downloadAndInstall === 'function') {
          clearInterval(waitForInject);
          window.AppUpdate.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version);
        } else if (waitCount > 10) {
          clearInterval(waitForInject);
          // 娉ㄥ叆瓒呮椂锛岄檷绾х敤绯荤粺娴忚鍣ㄦ墦寮€
          window.open(versionInfo.downloadUrl, '_system');
        }
      }, 300);
      return true;
    }
    // 缃戦〉鐜锛屾墦寮€涓嬭浇閾炬帴
    window.open(versionInfo.downloadUrl, '_blank');
    return true;
  } catch (error) {
    console.error('涓嬭浇鏇存柊澶辫触', error);
    // 闄嶇骇澶勭悊锛氱洿鎺ヨ烦杞?
    window.location.href = versionInfo.downloadUrl;
    return true;
  }
}

