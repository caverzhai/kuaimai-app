import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  ChevronRight,
  Package,
  Loader2,
  AlertCircle,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getProductList,
  getProductCategories,
} from '../../api';
import type {
  ProductInfo,
  ProductCategoryInfo,
  ProductListResponse,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import { getCache, setCache } from '../../utils/cache';

const PAGE_SIZE = 12;

// 固定的商品分类（用户要求）
const FIXED_CATEGORIES = [
  { id: 'service', name: '服务类' },
  { id: 'digital', name: '数字类' },
  { id: 'physical', name: '实物类' },
  { id: 'finance', name: '金融保险' },
  { id: 'realestate', name: '房产' },
  { id: 'beauty', name: '美容' },
  { id: 'health', name: '大健康' },
  { id: 'other', name: '其它' },
];

export default function MallPage({ visible = true }: { visible?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskAmount = searchParams.get('taskAmount');
  const taskId = searchParams.get('taskId');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // 关键：使用lazy initial state，组件第一次渲染时就从缓存读取数据，立即显示
  const [products, setProducts] = useState<ProductInfo[]>(() => {
    try {
      const cacheKey = `mall_products___${taskAmount || ''}`; // activeCategory='', keyword=''
      const cached = getCache<{ items: ProductInfo[]; total: number }>(cacheKey, true);
      if (cached && cached.items && cached.items.length > 0) {
        return cached.items;
      }
    } catch (e) {
      // 忽略缓存读取错误
    }
    return [];
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number>(() => {
    try {
      const cacheKey = `mall_products___${taskAmount || ''}`; // activeCategory='', keyword=''
      const cached = getCache<{ items: ProductInfo[]; total: number }>(cacheKey, true);
      if (cached) {
        return cached.total || 0;
      }
    } catch (e) {
      // 忽略缓存读取错误
    }
    return 0;
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 只有页面可见时才从服务器加载数据，减少APP启动时的并发请求
    if (!visible) return;
    setPage(1);
    // 后台从服务器更新（缓存数据已经在初始状态中显示了）
    fetchProducts(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, keyword, taskAmount, visible]);

  async function fetchCategories() {
    try {
      setCatLoading(true);
      const data = await getProductCategories();
      const list = (data as { items: ProductCategoryInfo[] }).items ?? data;
      setCategories(Array.isArray(list) ? list : []);
    } catch (err) {
      logger.error('加载分类失败', err);
    } finally {
      setCatLoading(false);
    }
  }

  async function fetchProducts(p: number, replace: boolean) {
    try {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const params: Record<string, unknown> = {
        page: p,
        pageSize: PAGE_SIZE,
      };
      if (activeCategory) params.category = activeCategory;
      if (keyword) params.keyword = keyword;
      const data = (await getProductList(params)) as ProductListResponse;
      // 防御性处理：确保items是数组
      const items = Array.isArray(data?.items) ? data.items : [];
      // 升级任务模式：只显示指定金额的商品
      let filteredItems = items;
      if (taskAmount) {
        filteredItems = items.filter((p: ProductInfo) => {
          const price = parseFloat(p.price);
          return Math.abs(price - parseFloat(taskAmount)) < 0.01;
        });
      }
      setProducts((prev) => (replace ? filteredItems : [...prev, ...filteredItems]));
      setTotal(taskAmount ? filteredItems.length : (data?.total ?? 0));
      setPage(p);
      // 写入缓存（只缓存第一页）
      if (replace && p === 1) {
        const cacheKey = `mall_products_${activeCategory}_${keyword}_${taskAmount || ''}`;
        setCache(cacheKey, { items: filteredItems, total: taskAmount ? filteredItems.length : (data?.total ?? 0) });
      }
    } catch (err) {
      logger.error('加载商品失败', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function handleSearch() {
    setKeyword(searchInput.trim());
  }

  function handleLoadMore() {
    fetchProducts(page + 1, false);
  }

  const hasMore = useMemo(
    () => products.length < total,
    [products.length, total],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部搜索栏 */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-orange-500 flex-shrink-0" />
            <h1 className="text-lg font-bold text-gray-900 hidden sm:block">
              快卖商城
            </h1>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索商品名称"
                className="w-full pl-9 pr-20 py-2 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition"
              />
              <button
                onClick={handleSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-orange-500 text-white text-xs rounded-full hover:bg-orange-600 transition"
              >
                搜索
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 升级任务模式提示条 */}
      {taskAmount && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-2">
            <Tag className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-sm text-orange-700 font-medium">
              升级任务模式：当前仅显示 ¥{taskAmount} 的商品，请购买对应金额商品完成任务
            </span>
            <button
              onClick={() => navigate('/tasks')}
              className="ml-auto text-xs text-orange-600 hover:text-orange-700 underline"
            >
              返回任务中心
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* 移动端分类tab */}
        <div className="md:hidden mb-4 overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 whitespace-nowrap">
            <button
              onClick={() => setActiveCategory('')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                !activeCategory
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              全部
            </button>
            {FIXED_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  activeCategory === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          {/* 桌面端左侧分类 */}
          <aside className="hidden md:block w-48 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-2 sticky top-20">
              <h3 className="px-3 py-2 text-sm font-semibold text-gray-900 border-b border-gray-100 mb-1">
                商品分类
              </h3>
              <button
                onClick={() => setActiveCategory('')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition ${
                  !activeCategory
                    ? 'bg-orange-50 text-orange-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>全部商品</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              {FIXED_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition ${
                    activeCategory === cat.id
                      ? 'bg-orange-50 text-orange-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{cat.name}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ))}
            </div>
          </aside>

          {/* 右侧商品列表 */}
          <main className="flex-1 min-w-0">
            {loading && (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <AlertCircle className="w-12 h-12 mb-3 text-orange-400" />
                <p className="text-sm mb-3">{error}</p>
                <button
                  onClick={() => fetchProducts(1, true)}
                  className="px-4 py-2 text-sm text-orange-500 border border-orange-500 rounded-full hover:bg-orange-50 transition"
                >
                  重试
                </button>
              </div>
            )}

            {!loading && !error && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Package className="w-16 h-16 mb-3" />
                <p className="text-sm">暂无商品</p>
              </div>
            )}

            {!loading && !error && products.length > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {products.map((product: ProductInfo) => (
                    <div
                      key={product.id}
                      onClick={() => navigate(`/product/${product.id}`)}
                      className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="aspect-square bg-gray-100 overflow-hidden">
                        {product.mainImages?.[0]?.url ? (
                          <Image
                            src={product.mainImages[0].url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package className="w-10 h-10" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug h-10">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-xs text-gray-400 line-clamp-1 mt-1">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-orange-500 font-bold text-base">
                            ¥{product.price}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 加载更多 */}
                {hasMore && (
                  <div className="flex justify-center mt-6 mb-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-8 py-2.5 bg-white border border-orange-200 text-orange-500 rounded-full text-sm font-medium hover:bg-orange-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          加载中...
                        </>
                      ) : (
                        '加载更多'
                      )}
                    </button>
                  </div>
                )}

                {!hasMore && products.length > 0 && (
                  <p className="text-center text-xs text-gray-400 mt-6 mb-4">
                    — 已经到底啦 —
                  </p>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
