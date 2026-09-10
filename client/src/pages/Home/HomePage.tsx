import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Users,
  ArrowRight,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getProductList, getConsultantList } from '@client/src/api';
import type { ProductInfo, ConsultantInfo } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const HomePage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [consultants, setConsultants] = useState<ConsultantInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productRes, consultantRes] = await Promise.all([
          getProductList({ page: 1, pageSize: 4 }),
          getConsultantList({ page: 1, pageSize: 4 }),
        ]);
        setProducts(productRes.items || []);
        setConsultants(consultantRes.items || []);
      } catch (error) {
        logger.error('获取首页数据失败', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-8 md:space-y-12">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-400 to-red-500 text-white p-6 md:p-12 shadow-lg">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-medium mb-4">
            <Sparkles size={14} />
            多级分销 · 快速变现
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">
            开启你的
            <br />
            电商分销事业
          </h1>
          <p className="mt-4 text-white/90 text-base md:text-lg">
            精选好物 + 专业咨询，7级分销体系，轻松创业无忧
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/mall')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-colors shadow-sm"
            >
              <ShoppingBag size={18} />
              进入商城
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/consultants')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur text-white font-semibold rounded-xl hover:bg-white/30 transition-colors border border-white/30"
            >
              <Users size={18} />
              找咨询师
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-orange-500 rounded-full" />
            <h2 className="text-xl font-bold text-gray-900">推荐商品</h2>
          </div>
          <button
            onClick={() => navigate('/mall')}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
          >
            查看全部 <ArrowRight size={14} />
          </button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i: number) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
            暂无推荐商品
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((product: ProductInfo) => (
              <div
                key={product.id}
                onClick={() => navigate(`/products/${product.id}`)}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="aspect-square bg-gray-50 overflow-hidden">
                  {product.mainImages?.[0]?.url ? (
                    <Image
                      src={product.mainImages[0].url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={40} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[2.5rem]">
                    {product.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-orange-600">
                      ¥{product.price}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-orange-500 rounded-full" />
            <h2 className="text-xl font-bold text-gray-900">推荐咨询师</h2>
          </div>
          <button
            onClick={() => navigate('/consultants')}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
          >
            查看全部 <ArrowRight size={14} />
          </button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i: number) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm p-4 animate-pulse"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto" />
                <div className="mt-3 h-4 bg-gray-100 rounded w-1/2 mx-auto" />
                <div className="mt-2 h-3 bg-gray-100 rounded w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        ) : consultants.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
            暂无推荐咨询师
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {consultants.map((c: ConsultantInfo) => (
              <div
                key={c.id}
                onClick={() => navigate(`/consultants/${c.id}`)}
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer text-center"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-orange-100 to-red-100 overflow-hidden flex items-center justify-center">
                  {c.avatarUrl ? (
                    <Image
                      src={c.avatarUrl}
                      alt={c.nickname}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users size={28} className="text-orange-500" />
                  )}
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">
                  {c.nickname}
                </h3>
                <p className="mt-1 text-xs text-orange-600 font-medium">
                  {c.level || '咨询师'}
                </p>
                {c.industry && (
                  <p className="mt-2 text-xs text-gray-500 truncate">
                    {c.industry}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Star size={12} className="text-orange-400" />
                    {c.directInviteCount} 学员
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp size={12} />
                    {c.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => navigate('/tasks')}
          className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">任务中心</h3>
              <p className="mt-1 text-sm text-white/80">
                待办任务、审核提醒一站式管理
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
            立即前往 <ArrowRight size={14} />
          </div>
        </div>
        <div
          onClick={() => navigate('/profile')}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">个人中心</h3>
              <p className="mt-1 text-sm text-gray-500">
                管理资料、查看收益与团队
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-orange-600">
            立即前往 <ArrowRight size={14} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
