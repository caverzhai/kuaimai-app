import { useState, useRef, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { createAdminProduct, updateAdminProduct } from '@client/src/api';
import { toast } from 'sonner';
import { Plus, X, Image as ImageIcon, Upload } from 'lucide-react';
import type { ProductInfo } from '@shared/api.interface';

interface ProductFormProps {
  product?: ProductInfo | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface MainImage {
  url: string;
  file?: File;
  preview?: string;
}

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name || '');
  const [unit, setUnit] = useState(product?.unit || '件');
  const [price, setPrice] = useState(product?.price ? String(product.price) : '');
  const [category, setCategory] = useState(product?.category || 'other');
  const [description, setDescription] = useState(product?.description || '');
  const [mainImages, setMainImages] = useState<MainImage[]>(
    product?.mainImages?.map((img: any) => ({ url: img.url || img })) || []
  );
  const [detailImages, setDetailImages] = useState<MainImage[]>(
    product?.detailImages?.map((img: any) => ({ url: img.url || img })) || []
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const CATEGORIES = [
    { value: 'service', label: '服务类' },
    { value: 'digital', label: '数字类' },
    { value: 'physical', label: '实物类' },
    { value: 'finance', label: '金融保险' },
    { value: 'realestate', label: '房产' },
    { value: 'beauty', label: '美容' },
    { value: 'health', label: '大健康' },
    { value: 'other', label: '其它' },
  ];

  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const detailImageInputRef = useRef<HTMLInputElement>(null);

  const MAX_NAME_LENGTH = 15;
  const MAX_MAIN_IMAGES = 5;
  const MAX_DETAIL_IMAGES = 10;

  // 压缩图片到指定尺寸
  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // 保持比例缩放
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建canvas上下文'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  // 上传图片到服务器
  const uploadImage = async (base64: string): Promise<string> => {
    try {
      const { axiosForBackend } = await import('@lark-apaas/client-toolkit/utils/getAxiosForBackend');
      const response = await axiosForBackend.post('/api/upload/image', { base64 });
      if (response.data.success) {
        return response.data.url;
      }
      throw new Error(response.data.message || '上传失败');
    } catch (error) {
      logger.error('图片上传失败', error);
      throw error;
    }
  };

  // 处理主图选择
  const handleMainImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_MAIN_IMAGES - mainImages.length;
    if (remaining <= 0) {
      toast(`最多只能上传${MAX_MAIN_IMAGES}张主图`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    setUploading(true);

    try {
      const newImages: MainImage[] = [];
      for (const file of filesToProcess) {
        // 压缩到800x800
        const compressed = await compressImage(file, 800, 800);
        newImages.push({ url: '', file, preview: compressed });
      }
      setMainImages([...mainImages, ...newImages]);
    } catch (error) {
      logger.error('图片处理失败', error);
      toast('图片处理失败');
    } finally {
      setUploading(false);
      if (mainImageInputRef.current) {
        mainImageInputRef.current.value = '';
      }
    }
  };

  // 处理详情图选择
  const handleDetailImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_DETAIL_IMAGES - detailImages.length;
    if (remaining <= 0) {
      toast(`最多只能上传${MAX_DETAIL_IMAGES}张详情图`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    setUploading(true);

    try {
      const newImages: MainImage[] = [];
      for (const file of filesToProcess) {
        // 详情图宽度1080，高度自适应
        const compressed = await compressImage(file, 1080, 10000);
        newImages.push({ url: '', file, preview: compressed });
      }
      setDetailImages([...detailImages, ...newImages]);
    } catch (error) {
      logger.error('图片处理失败', error);
      toast('图片处理失败');
    } finally {
      setUploading(false);
      if (detailImageInputRef.current) {
        detailImageInputRef.current.value = '';
      }
    }
  };

  // 删除主图
  const removeMainImage = (index: number) => {
    setMainImages(mainImages.filter((_, i) => i !== index));
  };

  // 删除详情图
  const removeDetailImage = (index: number) => {
    setDetailImages(detailImages.filter((_, i) => i !== index));
  };

  // 提交表单
  const handleSubmit = async () => {
    // 验证
    if (mainImages.length === 0) {
      toast('请至少上传1张主图');
      return;
    }
    if (!name.trim()) {
      toast('请输入产品名称');
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      toast(`产品名称最多${MAX_NAME_LENGTH}个汉字`);
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      toast('请输入有效的产品价格');
      return;
    }

    setSubmitting(true);
    try {
      // 上传所有图片
      toast('正在上传图片...');
      const uploadedMainImages: { url: string }[] = [];
      for (const img of mainImages) {
        if (img.preview) {
          const url = await uploadImage(img.preview);
          uploadedMainImages.push({ url });
        } else if (img.url) {
          uploadedMainImages.push({ url: img.url });
        }
      }

      const uploadedDetailImages: { url: string }[] = [];
      for (const img of detailImages) {
        if (img.preview) {
          const url = await uploadImage(img.preview);
          uploadedDetailImages.push({ url });
        } else if (img.url) {
          uploadedDetailImages.push({ url: img.url });
        }
      }

      const productData = {
        name: name.trim(),
        price: price,
        unit: unit,
        category: category,
        description: description,
        mainImages: uploadedMainImages,
        detailImages: uploadedDetailImages,
        status: 'on_sale',
      };

      if (isEdit && product) {
        // 编辑模式：更新商品
        await updateAdminProduct(product.id, productData);
        toast('商品更新成功');
      } else {
        // 添加模式：创建商品
        await createAdminProduct(productData);
        toast('商品创建成功');
      }

      onSuccess?.();
    } catch (error) {
      logger.error('创建商品失败', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast(`创建商品失败: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">
        {isEdit ? '编辑商品' : '添加新商品'}
      </h3>

      <div className="space-y-6">
        {/* 主图上传 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            商品主图 <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 ml-2">（最少1张，最多5张，建议800×800）</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {mainImages.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                {img.preview ? (
                  <img src={img.preview} alt={`主图${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <img src={img.url} alt={`主图${index + 1}`} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeMainImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {mainImages.length < MAX_MAIN_IMAGES && (
              <button
                type="button"
                onClick={() => mainImageInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
              >
                <Plus size={24} />
                <span className="text-xs mt-1">添加主图</span>
              </button>
            )}
          </div>
          <input
            ref={mainImageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleMainImageSelect}
            className="hidden"
          />
          <p className="text-xs text-gray-400 mt-2">已上传 {mainImages.length}/{MAX_MAIN_IMAGES} 张</p>
        </div>

        {/* 产品名称 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            产品名称 <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 ml-2">（最多{MAX_NAME_LENGTH}个汉字）</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            placeholder="请输入产品名称"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{name.length}/{MAX_NAME_LENGTH}</p>
        </div>

        {/* 产品分类 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            产品分类 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  category === cat.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 单位和价格 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">单位</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="如：件、个、盒"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              产品价格（元）<span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* 产品图文说明 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            产品图文说明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入产品详细说明、规格参数、使用方法等..."
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        {/* 详情图上传 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            商品详情图
            <span className="text-xs text-gray-400 ml-2">（宽度建议1080px，最多{MAX_DETAIL_IMAGES}张）</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {detailImages.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                {img.preview ? (
                  <img src={img.preview} alt={`详情图${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <img src={img.url} alt={`详情图${index + 1}`} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeDetailImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {detailImages.length < MAX_DETAIL_IMAGES && (
              <button
                type="button"
                onClick={() => detailImageInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
              >
                <ImageIcon size={24} />
                <span className="text-xs mt-1">详情图</span>
              </button>
            )}
          </div>
          <input
            ref={detailImageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleDetailImageSelect}
            className="hidden"
          />
          <p className="text-xs text-gray-400 mt-2">已上传 {detailImages.length}/{MAX_DETAIL_IMAGES} 张</p>
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Upload size={18} className="animate-pulse" />
                上传图片中...
              </>
            ) : submitting ? (
              '提交中...'
            ) : (
              '创建商品'
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting || uploading}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
