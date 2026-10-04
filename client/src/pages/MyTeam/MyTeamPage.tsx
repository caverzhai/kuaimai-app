import { useState, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getMyTeam as apiGetMyTeam } from '../../api';
import type { TeamInfo, TeamTreeNode } from '@shared/api.interface';
import { LEVEL_NAMES, LEVEL_LAYERS } from '@shared/api.interface';
import {
  Users,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  User,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { Image } from '@client/src/components/ui/image';
import { getErrorMessage } from '../../utils/errorMessage';
import { getDownlineDetails } from '../../api/stats';

interface TeamNodeProps {
  node: TeamTreeNode;
  depth: number;
  isLast: boolean;
  isRoot?: boolean;
  maxDepth: number; // 卖家=9（思维导图开放到下9代），非卖家=5（维持现状）
}

function TeamNode({ node, depth, isLast, isRoot, maxDepth }: TeamNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const levelName = LEVEL_NAMES[node.level] || node.level;
  const levelLayer = LEVEL_LAYERS[node.level] || 0;
  // 第5级及以上（depth >= 5）只显示人数，不显示姓名
  const isCollapsedLevel = depth >= 5;

  // 超过该用户可见的最大深度：截断不渲染
  if (depth > maxDepth) return null;

  if (isCollapsedLevel) {
    // 本支人数（含该成员自己及其全部后代），避免最后一代显示 0
    const branchTotal = 1 + (node.descendantCount ?? 0);
    return (
      <div className="relative">
        {!isRoot && (
          <div
            className="absolute left-0 border-l border-gray-200"
            style={{ top: 0, bottom: isLast ? '50%' : 0, width: '1px' }}
          />
        )}
        <div
          className="flex items-center gap-2 py-2 pl-1"
          style={{ paddingLeft: `${depth * 24 + 4}px` }}
        >
          {!isRoot && (
            <div className="w-3 h-px bg-gray-200 flex-shrink-0" />
          )}
          {hasChildren && depth < maxDepth ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-orange-500 transition-colors flex-shrink-0"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}
          <div className="flex items-center gap-2 flex-1 bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
            <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-500">
              第{depth}代下级 · 本支 {branchTotal} 人
            </span>
          </div>
        </div>
        {/* 卖家：折叠层继续递归，直到第 maxDepth 代；非卖家 maxDepth=5，此处不递归即维持现状 */}
        {hasChildren && depth < maxDepth && expanded && (
          <div>
            {node.children.map((child: TeamTreeNode, idx: number) => (
              <TeamNode
                key={child.userId}
                node={child}
                depth={depth + 1}
                isLast={idx === node.children.length - 1}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 连线辅助 */}
      {!isRoot && (
        <div
          className="absolute left-0 border-l border-gray-200"
          style={{ top: 0, bottom: isLast ? '50%' : 0, width: '1px' }}
        />
      )}

      <div
        className="flex items-center gap-2 py-2 pl-1"
        style={{ paddingLeft: `${depth * 24 + 4}px` }}
      >
        {/* 横线 */}
        {!isRoot && (
          <div className="w-3 h-px bg-gray-200 flex-shrink-0" />
        )}

        {/* 展开/收起按钮 */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-orange-500 transition-colors flex-shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-5 flex-shrink-0" />
        )}

        {/* 节点内容 */}
        <div className="flex items-center gap-2 flex-1 bg-white rounded-lg border border-gray-100 px-3 py-2 hover:border-orange-200 transition-colors">
          {/* 头像 */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {node.avatarUrl ? (
              <Image
                src={node.avatarUrl}
                alt={node.nickname}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-orange-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {node.nickname}
              {isRoot && (
                <span className="ml-1 text-xs text-orange-500">(我)</span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-px rounded">
                {levelName}
              </span>
              {levelLayer > 0 && (
                <span className="text-xs text-gray-400">L{levelLayer}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 子节点 */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child: TeamTreeNode, idx: number) => (
            <TeamNode
              key={child.userId}
              node={child}
              depth={depth + 1}
              isLast={idx === node.children.length - 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 树下某代会员详情（折叠）：直邀人数、团队人数、总收入
function DownlineLevelBlock({
  depth,
  members,
}: {
  depth: number;
  members: any[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-3 text-sm"
      >
        <span className="font-medium text-gray-800">
          下{depth}代（{members.length}人）
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="pb-3 space-y-2">
          {members.length === 0 && (
            <p className="text-xs text-gray-400 py-1">暂无成员</p>
          )}
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
            >
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {m.avatarUrl ? (
                  <Image
                    src={m.avatarUrl}
                    alt={m.nickname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-orange-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">
                  {m.nickname || '未命名'}
                  <span className="ml-1 text-xs text-orange-500">
                    {LEVEL_NAMES[m.level] ?? '初级'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">{m.phone}</div>
              </div>
              <div className="text-right text-xs text-gray-500 flex-shrink-0">
                <div>
                  直邀 {m.directInviteCount} · 团队 {m.teamCount}人
                </div>
                <div>个人 ¥{m.totalIncome.toFixed(0)}</div>
                <div className="text-orange-600 font-semibold">
                  团队 ¥{m.teamIncome.toFixed(0)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyTeamPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 树下五层会员详情
  const [downline, setDownline] = useState<any>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user?.isInvited) return;
    (async () => {
      try {
        setDownline(await getDownlineDetails(5));
      } catch (e) {
        logger.error('获取树下五层详情失败', e);
      }
    })();
  }, [authLoading, user]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetMyTeam();
      setData(result as TeamInfo);
    } catch (err) {
      logger.error('获取团队数据失败', err);
      setError(getErrorMessage(err, '加载团队关系树'));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Users className="h-10 w-10 text-orange-500" />
        <p className="text-gray-600">请登录后查看我的团队</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          去登录
        </button>
      </div>
    );
  }

  if (loading && !error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-muted-foreground">请先登录后查看团队</div>
      </div>
    );
  }

  if (!user.isInvited) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
          <UserPlus className="h-12 w-12 text-orange-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            请先补充邀请码
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            加入团队后才能查看您的团队结构和成员
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            去补充邀请码
          </button>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-destructive">{error}</div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <UserPlus className="h-4 w-4 text-orange-500" />
            有效直推人数
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data.directInviteCount}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <Users className="h-4 w-4 text-orange-500" />
            团队总人数
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data.teamTotalCount}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <Wallet className="h-4 w-4 text-orange-500" />
            个人总收入
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{(downline?.self?.totalIncome ?? 0).toFixed(0)}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            团队总收入
          </div>
          <div className="text-2xl font-bold text-orange-600">
            ¥{(downline?.self?.teamIncome ?? 0).toFixed(0)}
          </div>
        </div>
      </div>

      {/* 团队树 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-orange-500" />
          团队结构
        </h2>

        {data.tree ? (
          <TeamNode node={data.tree} depth={0} isLast={true} isRoot={true} maxDepth={user.isSeller ? 9 : 5} />
        ) : (
          <div className="text-center py-12 text-gray-400">
            暂无团队数据
          </div>
        )}
      </div>

      {/* 树下五层会员详情 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-2">
          <Wallet className="h-5 w-5 text-orange-500" />
          树下五层会员详情
        </h2>
        <p className="text-xs text-gray-500 mb-2">
          下1～下5代每位会员的有效直邀、团队人数，以及个人与团队实际到账总收入，点击各代展开。
        </p>
        {downline ? (
          (downline.levels ?? []).map((lv: any) => (
            <DownlineLevelBlock
              key={lv.depth}
              depth={lv.depth}
              members={lv.members}
            />
          ))
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">加载中...</p>
        )}
      </div>
    </div>
  );
}
