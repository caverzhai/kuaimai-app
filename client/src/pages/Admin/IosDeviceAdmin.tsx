import { useCallback, useEffect, useState } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import {
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Download,
  Loader2,
  Apple,
} from 'lucide-react';

interface DeviceItem {
  id: string;
  udid: string;
  product: string | null;
  deviceName: string | null;
  iosVersion: string | null;
  status: 'pending' | 'packaged';
  createdAt: string;
  nickname?: string | null;
  phone?: string | null;
  realName?: string | null;
}

export default function IosDeviceAdmin() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axiosForBackend.get('/api/ios-enroll/list');
      setDevices(r.data?.devices ?? []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // 仅未打包（待打包）的 UDID 最常用于下一次新增打包；同时提供"全部"
  const pendingUdids = devices.filter((d) => d.status !== 'packaged').map((d) => d.udid);
  const allUdids = devices.map((d) => d.udid);

  async function copyUdids(list: string[], label: string) {
    if (list.length === 0) {
      showToast('没有可复制的 UDID');
      return;
    }
    try {
      await navigator.clipboard.writeText(list.join('\n'));
      showToast(`已复制 ${list.length} 个${label} UDID`);
    } catch {
      showToast('复制失败，请逐条复制');
    }
  }

  function downloadUdids(list: string[]) {
    if (list.length === 0) {
      showToast('没有可导出的 UDID');
      return;
    }
    const blob = new Blob([list.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ios-udids.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copyOne(udid: string) {
    try {
      await navigator.clipboard.writeText(udid);
      showToast('UDID 已复制');
    } catch {
      // ignore
    }
  }

  async function mark(d: DeviceItem, status: 'pending' | 'packaged') {
    if (d.status === status) return;
    setBusyId(d.id);
    try {
      await axiosForBackend.post('/api/ios-enroll/mark', { id: d.id, status });
      await load();
    } catch {
      showToast('状态更新失败');
    } finally {
      setBusyId('');
    }
  }

  const pendingCount = pendingUdids.length;
  const packagedCount = devices.length - pendingCount;

  return (
    <div className="space-y-3">
      {/* 统计 + 批量操作 */}
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <Apple className="h-4 w-4 text-gray-700" />
          iOS 独立安装设备
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-600">
            待打包 {pendingCount}
          </span>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-600">
            已打包 {packagedCount}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
            共 {devices.length}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => copyUdids(pendingUdids, '待打包')}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs text-white active:bg-orange-600"
          >
            <Copy className="h-3.5 w-3.5" />
            复制待打包 UDID
          </button>
          <button
            onClick={() => copyUdids(allUdids, '')}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 active:bg-gray-50"
          >
            <Copy className="h-3.5 w-3.5" />
            复制全部
          </button>
          <button
            onClick={() => downloadUdids(allUdids)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 active:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" />
            导出 .txt
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 active:bg-gray-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          到 Apple 开发者后台添加设备时，可直接多行粘贴 UDID（每行一个）。新增设备登记后重新出 Ad Hoc 包，已登记设备无需重复上报。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          暂无设备申请
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {d.nickname || '未命名'}
                      <span className="ml-1 text-xs font-normal text-gray-400">
                        {d.phone}
                      </span>
                    </div>
                    {d.realName && (
                      <div className="text-[11px] text-gray-400">
                        实名：{d.realName}
                      </div>
                    )}
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {d.deviceName ? `${d.deviceName} · ` : ''}
                      {d.product || '未知型号'}
                      {d.iosVersion ? ` · iOS ${d.iosVersion}` : ''}
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                    d.status === 'packaged'
                      ? 'bg-green-50 text-green-600'
                      : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {d.status === 'packaged' ? '已打包' : '待打包'}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1">
                <span className="flex-1 break-all text-[11px] text-gray-500">
                  {d.udid}
                </span>
                <button
                  onClick={() => copyOne(d.udid)}
                  className="shrink-0 rounded p-1 text-gray-400 active:bg-gray-200"
                  title="复制 UDID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2 flex gap-2">
                {d.status === 'packaged' ? (
                  <button
                    disabled={busyId === d.id}
                    onClick={() => mark(d, 'pending')}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 active:bg-gray-50 disabled:opacity-50"
                  >
                    {busyId === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    标为待打包
                  </button>
                ) : (
                  <button
                    disabled={busyId === d.id}
                    onClick={() => mark(d, 'packaged')}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1 text-[11px] text-white active:bg-green-600 disabled:opacity-50"
                  >
                    {busyId === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    标为已打包
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-lg bg-gray-800 px-4 py-2 text-xs text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
