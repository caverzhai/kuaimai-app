// 原生权限请求工具（Capacitor APP 环境）
/* eslint-disable @typescript-eslint/no-explicit-any */

type PermissionCallback = (id: string, granted: boolean) => void;

declare global {
  interface Window {
    NativePermission?: {
      hasCameraPermission: () => boolean;
      requestCameraPermission: (callbackId: string) => void;
    };
    __onNativePermissionResult?: PermissionCallback;
  }
}

/**
 * 确保摄像头权限已授予。
 * - APP 环境：通过原生桥接请求运行时 CAMERA 权限
 * - Web 环境：直接返回 true（浏览器 getUserMedia 会自行处理）
 */
export function ensureCameraPermission(): Promise<boolean> {
  const np = window.NativePermission;
  if (!np) {
    return Promise.resolve(true);
  }
  try {
    if (np.hasCameraPermission()) {
      return Promise.resolve(true);
    }
  } catch {
    // ignore
  }
  return new Promise<boolean>((resolve) => {
    const callbackId = 'cam_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const handler: PermissionCallback = (id: string, granted: boolean) => {
      if (id === callbackId) {
        resolve(granted);
      }
    };
    window.__onNativePermissionResult = handler;
    try {
      np.requestCameraPermission(callbackId);
    } catch {
      resolve(false);
    }
    // 超时兜底（10秒无响应）
    setTimeout(() => resolve(false), 10000);
  });
}
