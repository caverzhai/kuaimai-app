import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Lock, Users, ChevronDown } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getConsultantList, getIndustries } from '../../api';
import type {
  ConsultantInfo,
  IndustryInfo,
  ConsultantListResponse,
} from '@shared/api.interface';
import { LEVEL_NAMES, LEVEL_LAYERS } from '@shared/api.interface';

const LEVEL_OPTIONS = [
  { value: '', label: '全部等级' },
  { value: 'level_4', label: '4级咨询师' },
  { value: 'level_5', label: '5级咨询师' },
  { value: 'level_6', label: '6级咨询师' },
  { value: 'level_7', label: '7级咨询团' },
  { value: 'level_8', label: '8级咨询团' },
];

function getLevelColorClass(level: string): string {
  const layer = LEVEL_LAYERS[level];
  switch (layer) {
    case 4:
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 5:
      return 'bg-green-100 text-green-700 border-green-200';
    case 6:
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 7:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 8:
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function ConsultantCard({ consultant }: { consultant: ConsultantInfo }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/consultant/${consultant.id}`)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md hover:border-orange-200 transition-all duration-200"
      data-ai-section-type="card-list"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Image
            src={consultant.avatarUrl || ''}
            alt={consultant.nickname}
            width={56}
            height={56}
            className="w-14 h-14 rounded-full object-cover bg-gray-100"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">
              {consultant.nickname}
            </h3>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 h-5 font-medium ${getLevelColorClass(consultant.level)}`}
            >
              {LEVEL_NAMES[consultant.level] || consultant.level}
            </Badge>
          </div>
          {consultant.industry && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {consultant.industry}
            </p>
          )}
        </div>
      </div>
      {consultant.serviceStandard && (
        <p className="text-sm text-gray-600 mt-3 line-clamp-2 leading-relaxed">
          {consultant.serviceStandard}
        </p>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users className="w-3.5 h-3.5" />
          <span>直推 {consultant.directInviteCount} 人</span>
        </div>
        <span className="text-xs text-orange-500 font-medium">查看详情 →</span>
      </div>
    </div>
  );
}

export default function ConsultantsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [consultants, setConsultants] = useState<ConsultantInfo[]>([]);
  const [industries, setIndustries] = useState<IndustryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [industry, setIndustry] = useState('');
  const [level, setLevel] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const pageSize = 10;

  const fetchIndustries = useCallback(async () => {
    try {
      const data = await getIndustries();
      setIndustries((data as { items: IndustryInfo[] }).items || (data as IndustryInfo[]));
    } catch (err) {
      logger.error('加载行业列表失败', err);
    }
  }, []);

  const fetchConsultants = useCallback(
    async (pageNum: number, reset: boolean, paramsIndustry: string, paramsLevel: string, paramsKeyword: string) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const data = (await getConsultantList({
          page: pageNum,
          pageSize,
          ...(paramsIndustry ? { industry: paramsIndustry } : {}),
          ...(paramsLevel ? { level: paramsLevel } : {}),
          ...(paramsKeyword ? { keyword: paramsKeyword } : {}),
        })) as ConsultantListResponse;
        if (reset) {
          setConsultants(data.items);
        } else {
          setConsultants((prev) => [...prev, ...data.items]);
        }
        setTotal(data.total);
        setHasMore(pageNum * pageSize < data.total);
        setPage(pageNum);
      } catch (err) {
        setError('加载咨询师列表失败，请稍后重试');
        logger.error('加载咨询师列表失败', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchIndustries();
  }, [fetchIndustries]);

  useEffect(() => {
    if (authLoading) return;
    // 未登录或未被邀请也允许加载，后端会返回对应结果；页面根据 user.isInvited 展示提示
    fetchConsultants(1, true, industry, level, keyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, industry, level, keyword]);

  const handleSearch = () => {
    setKeyword(searchInput.trim());
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchConsultants(page + 1, false, industry, level, keyword);
  };

  const isLocked = !authLoading && (!user || !user.isInvited);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            需填写邀请码解锁咨询师查看权限
          </h2>
          <p className="text-gray-500 mb-6">
            请先填写邀请码，验证通过后即可查看全部咨询师资料
          </p>
          <Button
            onClick={() => navigate('/supplement-inviter')}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            去填写邀请码
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">咨询师列表</h1>

      {/* 筛选区 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 行业下拉 */}
          <div className="relative sm:w-40">
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full h-10 px-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
            >
              <option value="">全部行业</option>
              {industries.map((ind) => (
                <option key={ind.id} value={ind.name}>
                  {ind.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* 等级下拉 */}
          <div className="relative sm:w-40">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full h-10 px-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
            >
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* 搜索框 */}
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索咨询师昵称"
                className="pl-9 h-10"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-orange-500 hover:bg-orange-600 text-white h-10"
            >
              搜索
            </Button>
          </div>
        </div>
      </div>

      {/* 列表区 */}
      {loading && consultants.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : error && consultants.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => fetchConsultants(1, true, industry, level, keyword)}
            className="mt-4"
          >
            重新加载
          </Button>
        </div>
      ) : consultants.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>暂无符合条件的咨询师</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {consultants.map((c) => (
              <ConsultantCard key={c.id} consultant={c} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full sm:w-auto min-w-[160px]"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    加载中...
                  </>
                ) : (
                  '加载更多'
                )}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-4">
            共 {total} 位咨询师
          </p>
        </>
      )}
    </div>
  );
}
