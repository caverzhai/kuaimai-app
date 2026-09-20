"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const bodyParser = require("body-parser");
const app_module_1 = require("./app.module");
async function initDatabase() {
    const logger = new common_1.Logger('DatabaseInit');
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
        }
        else {
            logger.warn('init.sql 文件不存在，跳过初始化');
        }
        try {
            logger.log('正在执行数据库迁移v2.1.0...');
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
            await sql.unsafe(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '其它';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '件';
      `);
            await sql.unsafe(`
        ALTER TABLE consult_orders ADD COLUMN IF NOT EXISTS task_id VARCHAR(100);
        ALTER TABLE consult_orders ADD COLUMN IF NOT EXISTS auto_confirm_deadline TIMESTAMP(3);
      `);
            await sql.unsafe(`
        ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS auto_delivery_deadline TIMESTAMP(3);
      `);
            try {
                await sql.unsafe(`
          UPDATE users SET consultant_level = '初级' WHERE consultant_level LIKE '%件%' OR consultant_level LIKE '%middle%';
          UPDATE products SET category = '其它' WHERE category LIKE '%件%' OR category LIKE '%other%';
        `);
                logger.log('历史乱码数据修复完成');
            }
            catch (fixError) {
                logger.warn('乱码数据修复跳过: ' + fixError.message);
            }
            logger.log('数据库迁移完成');
        }
        catch (migrationError) {
            logger.warn(`数据库迁移失败（可能已执行）: ${migrationError.message}`);
        }
        await sql.end();
    }
    catch (error) {
        logger.warn(`鏁版嵁搴撳垵濮嬪寲澶辫触锛堝彲鑳藉凡鍒濆鍖栵級: ${error.message}`);
    }
}
async function bootstrap() {
    await initDatabase();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        abortOnError: process.env.NODE_ENV !== 'development',
        bodyParser: false,
    });
    app.use(bodyParser.json({ limit: '2mb' }));
    const allowedOrigins = [
        'capacitor://localhost',
        'http://localhost',
        'http://localhost:3000',
        'http://localhost:5173',
        'https://backend-production-5d79.up.railway.app',
    ];
    if (process.env.CORS_ORIGINS) {
        allowedOrigins.push(...process.env.CORS_ORIGINS.split(',').map(s => s.trim()));
    }
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin) || origin.startsWith('http://192.168.') || origin.startsWith('http://10.')) {
                return callback(null, true);
            }
            if (process.env.NODE_ENV === 'development') {
                return callback(null, true);
            }
            return callback(new Error('不允许的跨域来源'), false);
        },
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Content-Disposition'],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true }));
    const logger = new common_1.Logger('Bootstrap');
    const possiblePublicPaths = [
        path.join(process.cwd(), 'server', 'public'),
        path.join(process.cwd(), 'dist', 'public'),
        path.join(process.cwd(), 'server', 'dist', 'public'),
        path.join(__dirname, '..', '..', '..', 'public'),
        path.join(__dirname, '..', '..', 'public'),
    ];
    const existingPublicPaths = possiblePublicPaths.filter(dir => fs.existsSync(dir));
    if (existingPublicPaths.length === 0) {
        const firstPath = possiblePublicPaths[0];
        existingPublicPaths.push(firstPath);
        logger.log(`静态文件目录已创建: ${firstPath}`);
    }
    const publicPath = existingPublicPaths[0];
    const uploadsDir = path.join(publicPath, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        logger.log(`上传目录已创建: ${uploadsDir}`);
    }
    existingPublicPaths.forEach((dir, index) => {
        app.useStaticAssets(dir, { prefix: '/' });
        logger.log(`静态文件服务已启用[${index}]: ${dir}`);
    });
    logger.log(`主静态文件目录: ${publicPath}`);
    logger.log(`process.cwd(): ${process.cwd()}`);
    logger.log(`__dirname: ${__dirname}`);
    const appIndexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(appIndexPath)) {
        app.use((req, res, next) => {
            if (req.path.startsWith('/api') ||
                req.path.startsWith('/download') ||
                req.path === '/version.json' ||
                req.path.includes('.')) {
                return next();
            }
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
    try {
        const { ConsultOrdersService } = await Promise.resolve().then(() => require('./modules/consult-orders/consult-orders.service'));
        const consultOrdersService = app.get(ConsultOrdersService);
        setInterval(async () => {
            try {
                await consultOrdersService.autoConfirmExpiredOrdersCron();
            }
            catch (e) {
                logger.error(`咨询订单自动确认定时任务异常: ${e}`);
            }
        }, 60 * 1000);
        logger.log('咨询订单自动确认定时任务已启动（每分钟执行）');
    }
    catch (e) {
        logger.error(`启动咨询订单自动确认定时任务失败: ${e}`);
    }
    try {
        const { ChatRoomsService } = await Promise.resolve().then(() => require('./modules/chat-rooms/chat-rooms.service'));
        const chatRoomsService = app.get(ChatRoomsService);
        setInterval(async () => {
            try {
                await chatRoomsService.activateScheduledRooms();
                await chatRoomsService.closeExpiredRooms();
            }
            catch (e) {
                logger.error(`聊天室定时任务异常: ${e}`);
            }
        }, 60 * 1000);
        logger.log('聊天室定时任务已启动（激活+关闭过期，每分钟执行）');
    }
    catch (e) {
        logger.error(`启动聊天室定时任务失败: ${e}`);
    }
    try {
        const { MallOrdersService } = await Promise.resolve().then(() => require('./modules/mall-orders/mall-orders.service'));
        const mallOrdersService = app.get(MallOrdersService);
        setInterval(async () => {
            try {
                await mallOrdersService.autoConfirmExpiredOrdersCron();
                await mallOrdersService.autoDeliverExpiredOrdersCron();
            }
            catch (e) {
                logger.error(`商城订单自动确认+自动收货定时任务异常: ${e}`);
            }
        }, 60 * 1000);
        logger.log('商城订单自动确认+自动收货定时任务已启动（每分钟执行）');
    }
    catch (e) {
        logger.error(`启动商城订单定时任务失败: ${e}`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map