/**
 * 全局图片压缩工具
 * 压缩规则：
 * - 最大边长不超过1280px
 * - 输出JPEG格式，质量0.8
 * - 保持原始宽高比
 */

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 1280;
const QUALITY = 0.8;

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @returns 压缩后的Blob
 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // 如果不是图片，直接返回
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 计算压缩后的尺寸
        let { width, height } = img;
        let scale = 1;

        if (width > MAX_WIDTH) {
          scale = Math.min(scale, MAX_WIDTH / width);
        }
        if (height > MAX_HEIGHT) {
          scale = Math.min(scale, MAX_HEIGHT / height);
        }

        width = Math.round(width * scale);
        height = Math.round(height * scale);

        // 使用Canvas压缩
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('无法创建Canvas上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 转换为JPEG Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // 如果压缩后比原图还大，返回原图
              if (blob.size > file.size) {
                resolve(file);
              } else {
                resolve(blob);
              }
            } else {
              reject(new Error('图片压缩失败'));
            }
          },
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 压缩图片并返回File对象
 * @param file 原始图片文件
 * @returns 压缩后的File
 */
export async function compressImageToFile(file: File): Promise<File> {
  const compressedBlob = await compressImage(file);
  const fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([compressedBlob], fileName, { type: 'image/jpeg' });
}
