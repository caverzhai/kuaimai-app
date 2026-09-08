import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
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

@Controller('api/upload')
export class UploadController {
  // 调试端点：查看服务器目录结构（不需要登录）
  @Get('debug')
  async debug() {
    try {
      const info: any = {
        processCwd: process.cwd(),
        dirname: __dirname,
        possiblePaths: [],
        uploadsDirs: [],
      };

      // 检查所有可能的 public 路径
      const possiblePublicDirs = [
        path.join(process.cwd(), 'public'), // /app/public
        path.join(process.cwd(), 'dist', 'public'), // /app/dist/public
        path.join(process.cwd(), 'server', 'public'), // /app/server/public (Railway 实际路径!)
        path.join(process.cwd(), 'server', 'dist', 'public'), // /app/server/dist/public
        path.join(__dirname, '..', '..', '..', 'public'), // /app/server/dist/public
        path.join(__dirname, '..', '..', '..', '..', 'public'), // /app/server/public
        path.join(__dirname, '..', '..', 'public'), // /app/server/dist/server/public
      ];

      for (const dir of possiblePublicDirs) {
        const exists = fs.existsSync(dir);
        const uploadsDir = path.join(dir, 'uploads');
        const uploadsExists = fs.existsSync(uploadsDir);
        let uploadsFiles: string[] = [];
        if (uploadsExists) {
          try {
            uploadsFiles = fs.readdirSync(uploadsDir);
          } catch (e) {
            uploadsFiles = ['读取失败: ' + (e as Error).message];
          }
        }
        info.possiblePaths.push({
          path: dir,
          exists,
          uploadsDir,
          uploadsExists,
          uploadsFilesCount: uploadsFiles.length,
          uploadsFiles: uploadsFiles.slice(0, 10),
        });
      }

      // 检查当前工作目录的结构
      try {
        info.cwdFiles = fs.readdirSync(process.cwd());
      } catch (e) {
        info.cwdFiles = ['读取失败: ' + (e as Error).message];
      }

      return { success: true, info };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  @Post('image')
  @UseGuards(AuthGuard)
  async uploadImage(@Body() body: UploadImageBody) {
    try {
      console.log('[Upload] 收到图片上传请求');
      
      if (!body.base64) {
        console.log('[Upload] 失败：图片数据为空');
        return { success: false, message: '图片数据不能为空' };
      }

      // 解析 base64 数据
      const matches = body.base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        console.log('[Upload] 失败：无效的图片格式');
        return { success: false, message: '无效的图片格式' };
      }

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      let imageBuffer = Buffer.from(matches[2], 'base64');
      console.log(`[Upload] 图片解析成功，格式: ${ext}, 原始大小: ${imageBuffer.length} bytes`);

      // 图片压缩：最大边不超过1280px，质量80%
      try {
        const metadata = await sharp(imageBuffer).metadata();
        const maxDim = 1280;
        let needResize = false;
        let resizeWidth: number | undefined;
        let resizeHeight: number | undefined;

        if (metadata.width && metadata.height) {
          if (metadata.width > maxDim || metadata.height > maxDim) {
            needResize = true;
            if (metadata.width >= metadata.height) {
              resizeWidth = maxDim;
            } else {
              resizeHeight = maxDim;
            }
          }
        }

        if (needResize) {
          const compressedBuffer = await sharp(imageBuffer)
            .resize({
              width: resizeWidth,
              height: resizeHeight,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
          console.log(`[Upload] 图片压缩完成: ${metadata.width}x${metadata.height} -> 压缩后 ${compressedBuffer.length} bytes (原始 ${imageBuffer.length} bytes)`);
          imageBuffer = compressedBuffer;
        } else {
          // 即使不需要调整大小，也统一压缩质量
          const compressedBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
          if (compressedBuffer.length < imageBuffer.length) {
            console.log(`[Upload] 图片质量压缩: ${imageBuffer.length} -> ${compressedBuffer.length} bytes`);
            imageBuffer = compressedBuffer;
          }
        }
      } catch (compressError) {
        console.warn('[Upload] 图片压缩失败，使用原图:', compressError);
      }

      // 生成文件名
      const randomName = crypto.randomBytes(8).toString('hex');
      const filename = `${Date.now()}_${randomName}.${ext}`;

      // 确保上传目录存在
      // 使用和 main.ts 中静态文件服务完全一致的路径计算方式
      const possiblePublicDirs = [
        path.join(process.cwd(), 'server', 'public'), // /app/server/public (Railway 实际路径!)
        path.join(process.cwd(), 'public'), // /app/public
        path.join(process.cwd(), 'dist', 'public'), // /app/dist/public
        path.join(process.cwd(), 'server', 'dist', 'public'), // /app/server/dist/public
        path.join(__dirname, '..', '..', '..', '..', 'public'), // /app/server/public
        path.join(__dirname, '..', '..', '..', 'public'), // /app/server/dist/public
      ];
      
      let publicDir = possiblePublicDirs[0];
      let selectedIndex = 0;
      for (let i = 0; i < possiblePublicDirs.length; i++) {
        if (fs.existsSync(possiblePublicDirs[i])) {
          publicDir = possiblePublicDirs[i];
          selectedIndex = i;
          break;
        }
      }
      
      // 如果都不存在，创建第一个目录（和静态文件服务一致）
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
        console.log('[Upload] public目录已创建:', publicDir);
      }
      
      const uploadDir = path.join(publicDir, 'uploads');
      console.log(`[Upload] process.cwd(): ${process.cwd()}`);
      console.log(`[Upload] __dirname: ${__dirname}`);
      console.log(`[Upload] 选择的public目录索引: ${selectedIndex}`);
      console.log(`[Upload] 选择的public目录: ${publicDir}`);
      console.log(`[Upload] 上传目录: ${uploadDir}`);
      console.log(`[Upload] public目录是否存在: ${fs.existsSync(publicDir)}`);
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('[Upload] 上传目录已创建:', uploadDir);
      }

      // 保存文件
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, imageBuffer);
      console.log(`[Upload] 文件已保存: ${filePath}`);

      // 验证文件是否保存成功
      const fileExists = fs.existsSync(filePath);
      const fileSize = fileExists ? fs.statSync(filePath).size : 0;
      console.log(`[Upload] 文件验证: 存在=${fileExists}, 大小=${fileSize} bytes`);

      // 返回访问 URL
      const baseUrl = process.env.APP_URL || 'https://backend-production-5d79.up.railway.app';
      const imageUrl = `${baseUrl}/uploads/${filename}`;
      console.log(`[Upload] 返回URL: ${imageUrl}`);

      return {
        success: true,
        url: imageUrl,
        filename,
        size: imageBuffer.length,
      };
    } catch (error) {
      console.error('[Upload] 图片上传失败:', error);
      return { success: false, message: '图片上传失败: ' + (error as Error).message };
    }
  }

  // 语音上传
  @Post('audio')
  @UseGuards(AuthGuard)
  async uploadAudio(@Body() body: UploadImageBody) {
    try {
      if (!body.base64) {
        return { success: false, message: 'base64 数据不能为空' };
      }

      // 解析 base64 数据
      const matches = body.base64.match(/^data:audio\/(\w+);base64,(.+)$/);
      if (!matches) {
        return { success: false, message: '无效的音频 base64 格式' };
      }

      const ext = matches[1] === 'webm' ? 'webm' : matches[1];
      const audioBuffer = Buffer.from(matches[2], 'base64');
      console.log(`[Upload] 音频解析成功，格式: ${ext}, 大小: ${audioBuffer.length} bytes`);

      // 生成文件名
      const randomName = crypto.randomBytes(8).toString('hex');
      const filename = `${Date.now()}_${randomName}.${ext}`;

      // 确保上传目录存在
      const possiblePublicDirs = [
        path.join(process.cwd(), 'server', 'public'),
        path.join(process.cwd(), 'public'),
        path.join(process.cwd(), 'dist', 'public'),
        path.join(process.cwd(), 'server', 'dist', 'public'),
      ];

      let publicDir = possiblePublicDirs[0];
      for (let i = 0; i < possiblePublicDirs.length; i++) {
        if (fs.existsSync(possiblePublicDirs[i])) {
          publicDir = possiblePublicDirs[i];
          break;
        }
      }

      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const uploadDir = path.join(publicDir, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 保存文件
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, audioBuffer);
      console.log(`[Upload] 音频文件已保存: ${filePath}`);

      // 返回访问 URL
      const baseUrl = process.env.APP_URL || 'https://backend-production-5d79.up.railway.app';
      const audioUrl = `${baseUrl}/uploads/${filename}`;

      return {
        success: true,
        url: audioUrl,
        filename,
        size: audioBuffer.length,
      };
    } catch (error) {
      console.error('[Upload] 音频上传失败:', error);
      return { success: false, message: '音频上传失败: ' + (error as Error).message };
    }
  }
}
