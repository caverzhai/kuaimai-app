import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Package,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getProductDetail } from '../../api';
import type { ProductInfo } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!id) return;
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchDetail() {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = (await getProductDetail(id)) as ProductInfo;
      setProduct(data);
    } catch (err) {
      logger.error('获取商品详情失败', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  function prevImage() {
    if (!product?.mainImages?.length) return;
    const total = product.mainImages.length;
    setCurrentImgIndex((prev) => (prev - 1 + total) % total);
  }

  function nextImage() {
    if (!product?.mainImages?.length) return;
    const total = product.mainImages.length;
    setCurrentImgIndex((prev) => (prev + 1) % total);
  }

  function decreaseQty() {
    setQuantity((q) => Math.max(1, q - 1));
  }

  function increaseQty() {
    setQuantity((q) => q + 1);
  }

  function handleBuyNow() {
    if (!id) return;
    navigate(`/order-confirm/${id}?quantity=${quantity}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 px-4">
        <AlertCircle className="w-12 h-12 mb-3 text-orange-400" />
        <p className="text-sm mb-3">{error || '商品不存在'}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-full hover:bg-gray-50 transition"
          >
            返回
          </button>
          <button
            onClick={fetchDetail}
            className="px-4 py-2 text-sm text-orange-500 border border-orange-500 rounded-full hover:bg-orange-50 transition"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const mainImages = product.mainImages ?? [];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部返回 */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 truncate">
            商品详情
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* 主图轮播 */}
        <div className="relative bg-white aspect-square overflow-hidden">
          {mainImages.length > 0 ? (
            <Image
              src={mainImages[currentImgIndex]?.url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100">
              <Package className="w-20 h-20" />
            </div>
          )}

          {mainImages.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              {/* 底部圆点 */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mainImages.map((_img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImgIndex(idx)}
                    className={`w-2 h-2 rounded-full transition ${
                      idx === currentImgIndex
                        ? 'bg-white w-5'
                        : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 商品信息卡片 */}
        <div className="bg-white mt-2 p-4 md:rounded-t-xl">
          <div className="flex items-baseline gap-2">
            <span className="text-orange-500 text-2xl font-bold">
              ¥{product.price}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              已售 {product.sales || 0} 件
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-gray-900 leading-snug">
            {product.name}
          </h2>
          {product.spec && (
            <p className="mt-2 text-sm text-gray-500">规格：{product.spec}</p>
          )}
          {product.description && (
            <p className="mt-2 text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{product.description}</p>
          )}
        </div>

        {/* 数量选择 */}
        <div className="bg-white mt-2 p-4 flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">购买数量</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={decreaseQty}
              disabled={quantity <= 1}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center text-sm font-medium text-gray-900">
              {quantity}
            </span>
            <button
              onClick={increaseQty}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 用户评价 */}
        <div className="bg-white mt-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              用户评价 ({product.reviewCount || 0})
            </h3>
            <div className="flex items-center gap-1">
              <span className="text-orange-500 text-sm font-medium">
                {product.rating || '5.0'}
              </span>
              <span className="text-xs text-gray-400">分</span>
            </div>
          </div>
          
          {/* 评价列表 */}
          <div className="space-y-4">
            {(product.reviews && product.reviews.length > 0) ? (
              product.reviews.map((review: any, idx: number) => (
                <div key={idx} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                      {review.avatar ? (
                        <img src={review.avatar} alt={review.nickname} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">{review.nickname?.[0] || '用'}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{review.nickname}</div>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map((star) => (
                          <span key={star} className={`text-xs ${star <= (review.rating || 5) ? 'text-orange-400' : 'text-gray-200'}`}>★</span>
                        ))}
                        <span className="text-xs text-gray-400 ml-1">{review.date}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{review.content}</p>
                  {review.images && review.images.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {review.images.map((img: string, imgIdx: number) => (
                        <img key={imgIdx} src={img} alt={`评价图${imgIdx+1}`} className="w-16 h-16 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">
                暂无评价，快来抢沙发吧~
              </div>
            )}
          </div>
        </div>

        {/* 详情长图 */}
        {product.detailImages && product.detailImages.length > 0 && (
          <div className="bg-white mt-2 p-4 md:rounded-b-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              商品详情
            </h3>
            <div className="space-y-1">
              {product.detailImages.map((img, idx) => (
                <Image
                  key={idx}
                  src={img.url}
                  alt={`详情图${idx + 1}`}
                  className="w-full rounded-lg"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部悬浮购买栏 - 在底部导航栏上方显示 */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0_0_0_0.05)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/mall')}
            className="flex flex-col items-center text-xs text-gray-500 px-2"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="mt-0.5">商城</span>
          </button>
          <button
            onClick={handleBuyNow}
            className="flex-1 h-11 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-semibold rounded-full shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
          >
            立即购买
          </button>
        </div>
      </div>
    </div>
  );
}
