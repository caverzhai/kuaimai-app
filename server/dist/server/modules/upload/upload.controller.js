"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("@server/common/guards/auth.guard");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
let UploadController = class UploadController {
    async debug() {
        try {
            const info = {
                processCwd: process.cwd(),
                dirname: __dirname,
                possiblePaths: [],
                uploadsDirs: [],
            };
            const possiblePublicDirs = [
                path.join(process.cwd(), 'public'),
                path.join(process.cwd(), 'dist', 'public'),
                path.join(process.cwd(), 'server', 'public'),
                path.join(process.cwd(), 'server', 'dist', 'public'),
                path.join(__dirname, '..', '..', '..', 'public'),
                path.join(__dirname, '..', '..', '..', '..', 'public'),
                path.join(__dirname, '..', '..', 'public'),
            ];
            for (const dir of possiblePublicDirs) {
                const exists = fs.existsSync(dir);
                const uploadsDir = path.join(dir, 'uploads');
                const uploadsExists = fs.existsSync(uploadsDir);
                let uploadsFiles = [];
                if (uploadsExists) {
                    try {
                        uploadsFiles = fs.readdirSync(uploadsDir);
                    }
                    catch (e) {
                        uploadsFiles = ['读取失败: ' + e.message];
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
            try {
                info.cwdFiles = fs.readdirSync(process.cwd());
            }
            catch (e) {
                info.cwdFiles = ['读取失败: ' + e.message];
            }
            return { success: true, info };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async uploadImage(body) {
        try {
            console.log('[Upload] 收到图片上传请求');
            if (!body.base64) {
                console.log('[Upload] 失败：图片数据为空');
                return { success: false, message: '图片数据不能为空' };
            }
            const matches = body.base64.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                console.log('[Upload] 失败：无效的图片格式');
                return { success: false, message: '无效的图片格式' };
            }
            const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            const imageBuffer = Buffer.from(matches[2], 'base64');
            console.log(`[Upload] 图片解析成功，格式: ${ext}, 大小: ${imageBuffer.length} bytes`);
            const randomName = crypto.randomBytes(8).toString('hex');
            const filename = `${Date.now()}_${randomName}.${ext}`;
            const possiblePublicDirs = [
                path.join(process.cwd(), 'server', 'public'),
                path.join(process.cwd(), 'public'),
                path.join(process.cwd(), 'dist', 'public'),
                path.join(process.cwd(), 'server', 'dist', 'public'),
                path.join(__dirname, '..', '..', '..', '..', 'public'),
                path.join(__dirname, '..', '..', '..', 'public'),
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
            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, imageBuffer);
            console.log(`[Upload] 文件已保存: ${filePath}`);
            const fileExists = fs.existsSync(filePath);
            const fileSize = fileExists ? fs.statSync(filePath).size : 0;
            console.log(`[Upload] 文件验证: 存在=${fileExists}, 大小=${fileSize} bytes`);
            const baseUrl = process.env.APP_URL || 'https://backend-production-5d79.up.railway.app';
            const imageUrl = `${baseUrl}/uploads/${filename}`;
            console.log(`[Upload] 返回URL: ${imageUrl}`);
            return {
                success: true,
                url: imageUrl,
                filename,
                size: imageBuffer.length,
            };
        }
        catch (error) {
            console.error('[Upload] 图片上传失败:', error);
            return { success: false, message: '图片上传失败: ' + error.message };
        }
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Get)('debug'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "debug", null);
__decorate([
    (0, common_1.Post)('image'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadImage", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('api/upload')
], UploadController);
//# sourceMappingURL=upload.controller.js.map