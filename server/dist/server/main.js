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
        }
        else {
            logger.warn('init.sql 文件不存在，跳过初始化');
        }
        try {
            logger.log('正在执行数据库迁移 v2.1.0...');
            await sql.unsafe(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS consultant_level VARCHAR(20) DEFAULT 'middle';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS service_introduction VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_id VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_front_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
      `);
            await sql.unsafe(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '件';
      `);
            logger.log('数据库迁移完成');
        }
        catch (migrationError) {
            logger.warn(`数据库迁移失败（可能已执行）: ${migrationError.message}`);
        }
        await sql.end();
    }
    catch (error) {
        logger.warn(`数据库初始化失败（可能已初始化）: ${error.message}`);
    }
}
async function bootstrap() {
    await initDatabase();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        abortOnError: process.env.NODE_ENV !== 'development',
        bodyParser: false,
    });
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: '*',
        exposedHeaders: '*',
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true }));
    const logger = new common_1.Logger('Bootstrap');
    const possiblePublicPaths = [
        path.join(process.cwd(), 'server', 'public'),
        path.join(process.cwd(), 'public'),
        path.join(process.cwd(), 'dist', 'public'),
        path.join(process.cwd(), 'server', 'dist', 'public'),
        path.join(__dirname, '..', '..', '..', 'public'),
        path.join(__dirname, '..', '..', 'public'),
    ];
    const existingPublicPaths = possiblePublicPaths.filter(dir => fs.existsSync(dir));
    if (existingPublicPaths.length === 0) {
        const firstPath = possiblePublicPaths[0];
        fs.mkdirSync(firstPath, { recursive: true });
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
}
bootstrap();
//# sourceMappingURL=main.js.map