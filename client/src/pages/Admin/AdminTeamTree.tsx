import { useEffect, useState } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { ChevronRight, Loader2, Store } from 'lucide-react';
import { LEVEL_NAMES } from '@shared/api.interface';

interface TreeNodeData {
  userId: string;
  nickname: string;
  phone: string;
  level: string;
  avatarUrl?: string;
  assessmentStatus: string | null;
  isSeller: boolean;
  treeLevel: number;
  position: number;
  hasChildren: boolean;
}

function levelBadgeClass(level: string): string {
  if (level === 'junior') return 'bg-gray-100 text-gray-500';
  return 'bg-orange-50 text-orange-600';
}

function NodeView({ node, isRoot }: { node: TreeNodeData; isRoot?: boolean }) {
  const [open, setOpen] = useState(!!isRoot);
  const [children, setChildren] = useState<TreeNodeData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const ensureLoaded = async () => {
    if (children) return;
    setLoading(true);
    setErr('');
    try {
      const res = await axiosForBackend.get('/api/admin/team/children', {
        params: { userId: node.userId },
      });
      setChildren((res.data?.children as TreeNodeData[]) || []);
    } catch {
      setErr('下级加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    ensureLoaded();
  };

  useEffect(() => {
    if (isRoot) {
      setOpen(true);
      ensureLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="select-none">
      <div className="flex items-center gap-2 py-1">
        {node.hasChildren ? (
          <button
            onClick={toggle}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 flex-shrink-0"
            title={open ? '收起分支' : '展开分支'}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ChevronRight
                size={14}
                className={`transition-transform ${open ? 'rotate-90' : ''}`}
              />
            )}
          </button>
        ) : (
          <span className="w-5 h-5 flex-shrink-0" />
        )}

        {node.avatarUrl ? (
          <img
            src={node.avatarUrl}
            alt={node.nickname}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs flex-shrink-0">
            {(node.nickname || '?').slice(0, 1)}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-gray-800">
            {node.nickname || '未命名'}
          </span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded ${levelBadgeClass(
              node.level,
            )}`}
          >
            {LEVEL_NAMES[node.level] ?? node.level}
          </span>
          {node.isSeller && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 inline-flex items-center gap-0.5">
              <Store size={11} /> 卖家
            </span>
          )}
          {node.assessmentStatus === 'eliminated' && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">
              已淘汰
            </span>
          )}
          <span className="text-[11px] text-gray-400">{node.phone}</span>
        </div>
      </div>

      {open && node.hasChildren && (
        <div className="ml-[10px] border-l border-gray-200 pl-3 mt-0.5 space-y-0.5">
          {loading && !children && (
            <div className="text-xs text-gray-400 py-1 inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> 加载中...
            </div>
          )}
          {children && children.length === 0 && (
            <div className="text-xs text-gray-400 py-1">暂无下级</div>
          )}
          {children &&
            children.map((c) => <NodeView key={c.userId} node={c} />)}
          {err && <div className="text-xs text-red-500 py-1">{err}</div>}
        </div>
      )}
    </div>
  );
}

export default function AdminTeamTree() {
  const [root, setRoot] = useState<TreeNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    axiosForBackend
      .get('/api/admin/team/children')
      .then((res) => setRoot((res.data?.parent as TreeNodeData) || null))
      .catch(() => setErr('关系树根节点加载失败，请刷新重试'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-400 py-12 inline-flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" /> 加载关系树...
      </div>
    );
  }
  if (err || !root) {
    return <div className="text-sm text-red-500 py-12">{err || '关系树为空'}</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">全用户关系树</h2>
      <p className="text-xs text-gray-500 mb-4">
        思维导图自上而下排列。点击节点左侧箭头仅加载该分支的直接下级，逐分支展开，加载更快。
      </p>
      <div className="overflow-x-auto">
        <NodeView node={root} isRoot />
      </div>
    </div>
  );
}
