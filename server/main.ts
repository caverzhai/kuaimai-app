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
    logger.warn('DATABASE_URL 鏈缃紝璺宠繃鏁版嵁搴撳垵濮嬪寲');
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
      logger.log('正在执行数据库迁移v2.1.0...');
      // users 表添加咨询师相关字段
      await sql.unsafe(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS consultant_level VARCHAR(20) DEFAULT '初级';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS service_introduction VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_id VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_front_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_back_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_number VARCHAR(20);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
      `);

      // products 表添加分类和单位字段
      await sql.unsafe(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '其它';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '件';
      `);

      // consult_orders 表添加 taskId 字段（用于防重复购买）
      await sql.unsafe(`
        ALTER TABLE consult_orders ADD COLUMN IF NOT EXISTS task_id VARCHAR(100);
        ALTER TABLE consult_orders ADD COLUMN IF NOT EXISTS auto_confirm_deadline TIMESTAMP(3);
      `);

      // mall_orders 表添加 auto_delivery_deadline 字段（自动收货）
      await sql.unsafe(`
        ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS auto_delivery_deadline TIMESTAMP(3);
      `);

      // 修复历史乱码数据
      try {
        await sql.unsafe(`
          UPDATE users SET consultant_level = '初级' WHERE consultant_level LIKE '%件%' OR consultant_level LIKE '%middle%';
          UPDATE products SET category = '其它' WHERE category LIKE '%件%' OR category LIKE '%other%';
        `);
        logger.log('历史乱码数据修复完成');
      } catch (fixError) {
        logger.warn('乱码数据修复跳过: ' + fixError.message);
      }

      logger.log('数据库迁移完成');
    } catch (migrationError: any) {
      logger.warn(`数据库迁移失败（可能已执行）: ${migrationError.message}`);
    }

    await sql.end();
  } catch (error: any) {
    logger.warn(`鏁版嵁搴撳垵濮嬪寲澶辫触锛堝彲鑳藉凡鍒濆鍖栵級: ${error.message}`);
  }
}

async function bootstrap() {
  // 先初始化数据库
  await initDatabase();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
    bodyParser: false, // 鍏抽棴榛樿鐨?body-parser锛屾墜鍔ㄩ厤缃洿澶х殑闄愬埗
  });

  // 手动配置 body-parser，限制为 50MB（支持大图 base64 上传）
  app.use(bodyParser.json({ limit: '50mb' }));

  // 启用 CORS（允许所有来源，包括 Android WebView 的 capacitor://localhost 和 http://localhost）
  app.enableCors({
    origin: true, // 动态允许所有来源
    allowedHeaders: '*',
    exposedHeaders: '*',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // 鍏ㄥ眬楠岃瘉绠￠亾
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const logger = new Logger('Bootstrap');

  // 静态文件服务（版本信息、APK下载、前端静态文件等）
  // 使用多种方式计算路径，确保在不同环境下都能正确找到 public 目录
  const possiblePublicPaths = [
    path.join(process.cwd(), 'server', 'public'), // /app/server/public (Railway 实际路径!)
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
  logger.log(`API endpoints ready at http://${host}:${port}/api`);

  // 启动定时任务：每分钟自动确认超时的咨询订单（20分钟未审核自动确认）
  try {
    const { ConsultOrdersService } = await import('./modules/consult-orders/consult-orders.service');
    const consultOrdersService = app.get(ConsultOrdersService);
    setInterval(async () => {
      try {
        await consultOrdersService.autoConfirmExpiredOrdersCron();
      } catch (e) {
        logger.error(`咨询订单自动确认定时任务异常: ${e}`);
      }
    }, 60 * 1000); // 每分钟执行一次
    logger.log('咨询订单自动确认定时任务已启动（每分钟执行）');
  } catch (e) {
    logger.error(`启动咨询订单自动确认定时任务失败: ${e}`);
  }

  // 启动定时任务：每分钟激活到时间的聊天室 + 关闭过期聊天室
  try {
    const { ChatRoomsService } = await import('./modules/chat-rooms/chat-rooms.service');
    const chatRoomsService = app.get(ChatRoomsService);
    setInterval(async () => {
      try {
        await chatRoomsService.activateScheduledRooms();
        await chatRoomsService.closeExpiredRooms();
      } catch (e) {
        logger.error(`聊天室定时任务异常: ${e}`);
      }
    }, 60 * 1000); // 每分钟执行一次
    logger.log('聊天室定时任务已启动（激活+关闭过期，每分钟执行）');
  } catch (e) {
    logger.error(`启动聊天室定时任务失败: ${e}`);
  }

  // 启动定时任务：每分钟自动确认超时的商城订单（20分钟未审核自动确认）+ 自动收货
  try {
    const { MallOrdersService } = await import('./modules/mall-orders/mall-orders.service');
    const mallOrdersService = app.get(MallOrdersService);
    setInterval(async () => {
      try {
        await mallOrdersService.autoConfirmExpiredOrdersCron();
        await mallOrdersService.autoDeliverExpiredOrdersCron();
      } catch (e) {
        logger.error(`商城订单自动确认+自动收货定时任务异常: ${e}`);
      }
    }, 60 * 1000); // 每分钟执行一次
    logger.log('商城订单自动确认+自动收货定时任务已启动（每分钟执行）');
  } catch (e) {
    logger.error(`启动商城订单定时任务失败: ${e}`);
  }
}

bootstrap();
