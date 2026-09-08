import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import * as postgres from 'postgres';
import * as bodyParser from 'body-parser';

import { AppModule } from './app.module';

async function initDatabase() {
  const logger = new Logger('DatabaseInit');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL 未设置，跳过数据库初始化');
    return;
  }

  try {
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 30 });
    const initSqlPath = path.join(__dirname, 'database', 'init.sql');
    
    if (fs.existsSync(initSqlPath)) {
      const initSql = fs.readFileSync(initSqlPath, 'utf-8');
      logger.log('正在初始化数据库...');
      await sql.unsafe(initSql);
      logger.log('数据库初始化完成');
    } else {
      logger.warn('init.sql 文件不存在，跳过初始化');
    }

    // 执行数据库迁移（直接在代码中执行，不依赖外部文件）
    try {
      logger.log('正在执行数据库迁移 v2.1.0...');

      // users 表添加咨询师相关字段
      await sql.unsafe(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS consultant_level VARCHAR(20) DEFAULT 'middle';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS service_introduction VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_id VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_front_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
      `);

      // products 表添加分类和单位字段
      await sql.unsafe(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '件';
      `);

      logger.log('数据库迁移完成');
    } catch (migrationError: any) {
      logger.warn(`数据库迁移失败（可能已执行）: ${migrationError.message}`);
    }

    await sql.end();
  } catch (error: any) {
    logger.warn(`数据库初始化失败（可能已初始化）: ${error.message}`);
  }
}

async function bootstrap() {
  // 先初始化数据库
  await initDatabase();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
    bodyParser: false, // 关闭默认的 body-parser，手动配置更大的限制
  });

  // 手动配置 body-parser，限制为 50MB（支持大图 base64 上传）
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // 启用 CORS（允许所有来源，包括 Android WebView 的 capacitor://localhost 和 http://localhost）
  app.enableCors({
    origin: true, // 动态允许所有来源
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: '*',
    exposedHeaders: '*',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const logger = new Logger('Bootstrap');

  // 静态文件服务（版本信息、APK下载、前端静态文件等）
  // 使用多种方式计算路径，确保在不同环境下都能正确找到 public 目录
  const possiblePublicPaths = [
    path.join(process.cwd(), 'server', 'public'), // /app/server/public (Railway 实际路径!)
    path.join(process.cwd(), 'public'), // /app/public
    path.join(process.cwd(), 'dist', 'public'), // /app/dist/public
    path.join(process.cwd(), 'server', 'dist', 'public'), // /app/server/dist/public
    path.join(__dirname, '..', '..', '..', 'public'), // /app/server/public
    path.join(__dirname, '..', '..', 'public'), // /app/server/dist/public
  ];
  
  // 同时提供所有存在的 public 目录，确保新旧上传的图片都能访问
  const existingPublicPaths = possiblePublicPaths.filter(dir => fs.existsSync(dir));
  
  if (existingPublicPaths.length === 0) {
    // 如果都不存在，创建第一个目录
    const firstPath = possiblePublicPaths[0];
    fs.mkdirSync(firstPath, { recursive: true });
    existingPublicPaths.push(firstPath);
    logger.log(`静态文件目录已创建: ${firstPath}`);
  }
  
  // 主静态文件目录（第一个存在的目录）
  const publicPath = existingPublicPaths[0];
  
  // 确保 uploads 目录存在于主目录
  const uploadsDir = path.join(publicPath, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.log(`上传目录已创建: ${uploadsDir}`);
  }
  
  // 同时提供所有存在的 public 目录（确保新旧图片都能访问）
  existingPublicPaths.forEach((dir, index) => {
    app.useStaticAssets(dir, { prefix: '/' });
    logger.log(`静态文件服务已启用[${index}]: ${dir}`);
  });
  
  logger.log(`主静态文件目录: ${publicPath}`);
  logger.log(`process.cwd(): ${process.cwd()}`);
  logger.log(`__dirname: ${__dirname}`);

  // SPA fallback：所有非 API、非静态文件的请求都返回前端 index.html
  // 这样前端路由（如 /register、/login 等）才能正常工作
  const appIndexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(appIndexPath)) {
    app.use((req, res, next) => {
      // 跳过 API 请求、静态文件请求、下载请求
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/download') ||
        req.path === '/version.json' ||
        req.path.includes('.') // 带扩展名的请求（静态文件）
      ) {
        return next();
      }
      // 返回前端 index.html
      res.sendFile(appIndexPath);
    });
    logger.log('SPA fallback 已启用');
  }

  const port = Number(process.env.PORT || process.env.SERVER_PORT || '3000');
  const host = process.env.SERVER_HOST || '0.0.0.0';

  await app.listen(port, host);
  logger.log(`Server running on http://${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
