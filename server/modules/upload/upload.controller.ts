import {
  Body,
  Controller,
  Post,
  UseGuards,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AuthGuard } from '@server/common/guards/auth.guard';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

interface UploadImageBody {
  base64: string;
  filename?: string;
}

const MAX_IMAGE_BASE64_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 720;
const IMAGE_QUALITY = 80;

@Controller('api/upload')
export class UploadController {
  @Post('image')
  @UseGuards(AuthGuard)
  async uploadImage(@Body() body: UploadImageBody) {
    try {
      if (!body.base64) {
        return { success: false, message: '图片数据不能为空' };
      }
      if (body.base64.length > MAX_IMAGE_BASE64_SIZE * 1.37) {
        throw new PayloadTooLargeException('图片过大，请压缩后再上传（最大5MB）');
      }
      const matches = body.base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return { success: false, message: '无效的图片格式' };
      }
      const ext = 'jpg';
      let imageBuffer = Buffer.from(matches[2], 'base64');
      try {
        const metadata = await sharp(imageBuffer).metadata();
        let resizeWidth: number | undefined;
        let resizeHeight: number | undefined;
        if (metadata.width && metadata.height) {
          if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
            if (metadata.width >= metadata.height) {
              resizeWidth = MAX_IMAGE_DIMENSION;
            } else {
              resizeHeight = MAX_IMAGE_DIMENSION;
            }
          }
        }
        const compressedBuffer = await sharp(imageBuffer)
          .resize({ width: resizeWidth, height: resizeHeight, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: IMAGE_QUALITY, mozjpeg: true })
          .toBuffer();
        imageBuffer = compressedBuffer;
      } catch {
        try {
          imageBuffer = await sharp(imageBuffer).jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer();
        } catch {}
      }
      const randomName = crypto.randomBytes(8).toString('hex');
      const filename = `${Date.now()}_${randomName}.${ext}`;
      const publicDir = this.getPublicDir();
      const uploadDir = path.join(publicDir, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, imageBuffer);
      const baseUrl = process.env.APP_URL || 'https://backend-production-5d79.up.railway.app';
      const imageUrl = `${baseUrl}/uploads/${filename}`;
      return { success: true, url: imageUrl, filename, size: imageBuffer.length };
    } catch (error) {
      if (error instanceof PayloadTooLargeException) throw error;
      return { success: false, message: '图片上传失败: ' + (error as Error).message };
    }
  }

  @Post('audio')
  @UseGuards(AuthGuard)
  async uploadAudio(@Body() body: UploadImageBody) {
    try {
      if (!body.base64) {
        return { success: false, message: 'base64 数据不能为空' };
      }
      if (body.base64.length > 10 * 1024 * 1024 * 1.37) {
        throw new PayloadTooLargeException('音频过大（最大10MB）');
      }
      const matches = body.base64.match(/^data:audio\/(\w+);base64,(.+)$/);
      if (!matches) {
        return { success: false, message: '无效的音频 base64 格式' };
      }
      const ext = matches[1] === 'webm' ? 'webm' : 'mp3';
      const audioBuffer = Buffer.from(matches[2], 'base64');
      const randomName = crypto.randomBytes(8).toString('hex');
      const filename = `${Date.now()}_${randomName}.${ext}`;
      const publicDir = this.getPublicDir();
      const uploadDir = path.join(publicDir, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, audioBuffer);
      const baseUrl = process.env.APP_URL || 'https://backend-production-5d79.up.railway.app';
      const audioUrl = `${baseUrl}/uploads/${filename}`;
      return { success: true, url: audioUrl, filename, size: audioBuffer.length };
    } catch (error) {
      if (error instanceof PayloadTooLargeException) throw error;
      return { success: false, message: '音频上传失败: ' + (error as Error).message };
    }
  }

  private getPublicDir(): string {
    const possiblePublicDirs = [
      path.join(process.cwd(), 'server', 'public'),
      path.join(process.cwd(), 'public'),
      path.join(process.cwd(), 'dist', 'public'),
      path.join(process.cwd(), 'server', 'dist', 'public'),
      path.join(__dirname, '..', '..', '..', '..', 'public'),
      path.join(__dirname, '..', '..', '..', 'public'),
    ];
    for (const dir of possiblePublicDirs) {
      if (fs.existsSync(dir)) return dir;
    }
    const firstDir = possiblePublicDirs[0];
    fs.mkdirSync(firstDir, { recursive: true });
    return firstDir;
  }
}