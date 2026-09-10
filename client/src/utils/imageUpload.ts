// 通用图片上传工具
import { logger } from '@lark-apaas/client-toolkit/logger';

/**
 * 将文件读取为base64
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 压缩图片（最大边1280px，质量80%）
 */
export function compressImage(base64: string, maxSize = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/**
 * 上传图片到服务器，返回真实URL
 */
export async function uploadImageToServer(file: File): Promise<string> {
  // 1. 读取为base64
  const base64 = await readFileAsBase64(file);
  logger.log('[ImageUpload] 文件读取成功，base64长度:', base64.length);

  // 2. 压缩图片
  const compressed = await compressImage(base64);
  logger.log('[ImageUpload] 图片压缩完成，base64长度:', compressed.length);

  // 3. 上传到服务器（带超时保护）
  const { axiosForBackend } = await import('@lark-apaas/client-toolkit/utils/getAxiosForBackend');

  const uploadPromise = axiosForBackend.post('/api/upload/image', { base64: compressed });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('上传超时')), 30000);
  });

  const response = (await Promise.race([uploadPromise, timeoutPromise])) as {
    data: { success: boolean; url: string; message?: string };
  };

  logger.log('[ImageUpload] 服务器响应:', response.data);

  if (!response.data.success) {
    throw new Error(response.data.message || '上传失败');
  }

  return response.data.url;
}
