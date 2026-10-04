import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import QRCode from 'qrcode';
import {
  Smartphone,
  Apple,
  QrCode as QrCodeIcon,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Clock,
  Link2,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '../../utils/errorMessage';

interface DeviceItem {
  id: string;
  udid: string;
  product: string | null;
  deviceName: string | null;
  iosVersion: string | null;
  status: 'pending' | 'packaged';
  createdAt: string;
}

// 常见机型内部标识 → 商品名（未知则原样显示）
const PRODUCT_NAMES: Record<string, string> = {
  'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,2': 'iPhone 13',
  'iPhone14,3': 'iPhone 13 Pro',
  'iPhone14,4': 'iPhone 13 Pro Max',
  'iPhone14,5': 'iPhone 13 mini',
  'iPhone14,7': 'iPhone 14',
  'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro',
  'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15',
  'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro',
  'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,1': 'iPhone 16 Pro',
  'iPhone17,2': 'iPhone 16 Pro Max',
  'iPhone17,3': 'iPhone 16',
  'iPhone17,4': 'iPhone 16 Plus',
};

function productName(p: string | null): string {
  if (!p) return '未知机型';
  return PRODUCT_NAMES[p] ?? p;
}

export default function IosInstallPage() {
  const { user, loading: authLoading } = useAuth();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [enrollUrl, setEnrollUrl] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const ua = navigator.userAgent;
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isIosBrowser = isIos && !Capacitor.isNativePlatform();

  const loadMy = useCallback(async () => {
    try {
      const r = await axiosForBackend.get('/api/ios-enroll/my');
      setDevices(r.data?.devices ?? []);
    } catch {
      // 静默：未登录或无记录
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadMy();
  }, [authLoading, user, loadMy]);

  async function handleApply() {
    setBusy(true);
    setError('');
    setHint('');
    try {
      const r = await axiosForBackend.post('/api/ios-enroll/start');
      const url: string = r.data?.enrollUrl;
      if (!url) throw new Error('生成申请链接失败');
      if (isIosBrowser) {
        window.location.href = url;
        setHint(
          '描述文件开始下载后，请打开 iPhone「设置」→ 通用 → VPN 与设备管理，安装描述文件。安装完成后回到本页，点“我已安装，刷新状态”。',
        );
      } else {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 560,
          margin: 1.5,
          color: { dark: '#1f2937', light: '#ffffff' },
        });
        setQrDataUrl(dataUrl);
        setEnrollUrl(url);
      }
    } catch (e: any) {
      setError(getErrorMessage(e, '生成申请失败'));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!enrollUrl) return;
    try {
      await navigator.clipboard.writeText(enrollUrl);
      setHint('链接已复制，可发送到 iPhone，用 Safari 打开');
      setTimeout(() => setHint(''), 3000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="px-4 py-4 pb-28">
      {/* 标题说明 */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <Apple className="h-6 w-6" />
          <h1 className="text-lg font-semibold">苹果手机 App 独立安装</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-orange-50">
          苹果采用 Ad Hoc 独立分发，需先登记你这台 iPhone 的设备标识
          (UDID)，平台统一打包后即可在本机安装、并可覆盖升级、保留数据。
        </p>
      </div>

      {/* 已上报设备 */}
      {devices.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            已上报设备（{devices.length}）
          </div>
          <div className="space-y-2">
            {devices.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <Smartphone className="h-4 w-4 text-gray-500" />
                    {productName(d.product)}
                    {d.iosVersion ? (
                      <span className="text-xs text-gray-400">
                        iOS {d.iosVersion}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      d.status === 'packaged'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-orange-50 text-orange-600'
                    }`}
                  >
                    {d.status === 'packaged' ? '已打包' : '待打包'}
                  </span>
                </div>
                <div className="mt-2 break-all text-xs text-gray-400">
                  UDID：{d.udid}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作区 */}
      <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {isIosBrowser ? (
          <>
            <p className="text-sm text-gray-600">
              检测到你正在 iPhone 浏览器上，可直接上报本机 UDID：
            </p>
            <button
              onClick={handleApply}
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-medium text-white active:bg-orange-600 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Apple className="h-4 w-4" />
              )}
              开始上报本机 UDID
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              请用你要安装的那台 iPhone 操作。先生成专属二维码：
            </p>
            <button
              onClick={handleApply}
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-medium text-white active:bg-orange-600 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCodeIcon className="h-4 w-4" />
              )}
              {qrDataUrl ? '重新生成二维码' : '生成安装二维码'}
            </button>

            {qrDataUrl && (
              <div className="mt-4 flex flex-col items-center">
                <img
                  src={qrDataUrl}
                  alt="安装二维码"
                  className="w-60 rounded-xl border border-gray-100"
                />
                <ol className="mt-3 w-full space-y-1.5 text-xs leading-relaxed text-gray-600">
                  <li>
                    1. 用目标 iPhone 的<strong>自带相机</strong>扫描此二维码
                  </li>
                  <li>2. 在弹出的 Safari 页面按提示下载并安装描述文件</li>
                  <li>3. 安装完成即上报成功，等待平台统一打包通知</li>
                </ol>
                <button
                  onClick={copyLink}
                  className="mt-3 flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 active:bg-gray-50"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  复制链接（可发到 iPhone 用 Safari 打开）
                </button>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock className="h-3 w-3" />
                  二维码 30 分钟内有效，过期请重新生成
                </div>
              </div>
            )}
          </>
        )}

        {hint && (
          <div className="mt-3 rounded-lg bg-blue-50 p-2.5 text-xs leading-relaxed text-blue-700">
            {hint}
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* 刷新状态 */}
      <button
        onClick={loadMy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm text-gray-600 active:bg-gray-50"
      >
        <RefreshCw className="h-4 w-4" />
        我已安装，刷新状态
      </button>
    </div>
  );
}
