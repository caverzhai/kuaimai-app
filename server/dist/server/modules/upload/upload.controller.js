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
const auth_guard_1 = require("../../common/guards/auth.guard");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp_1 = require("sharp");
const MAX_IMAGE_BASE64_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 720;
const IMAGE_QUALITY = 80;
let UploadController = class UploadController {
    async uploadImage(body) {
        try {
            if (!body.base64) {
                return { success: false, message: '图片数据不能为空' };
            }
            if (body.base64.length > MAX_IMAGE_BASE64_SIZE * 1.37) {
                throw new common_1.PayloadTooLargeException('图片过大，请压缩后再上传（最大5MB）');
            }
            const matches = body.base64.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                return { success: false, message: '无效的图片格式' };
            }
            const ext = 'jpg';
            let imageBuffer = Buffer.from(matches[2], 'base64');
            try {
                const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
                let resizeWidth;
                let resizeHeight;
                if (metadata.width && metadata.height) {
                    if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
                        if (metadata.width >= metadata.height) {
                            resizeWidth = MAX_IMAGE_DIMENSION;
                        }
                        else {
                            resizeHeight = MAX_IMAGE_DIMENSION;
                        }
                    }
                }
                const compressedBuffer = await (0, sharp_1.default)(imageBuffer)
                    .resize({ width: resizeWidth, height: resizeHeight, fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: IMAGE_QUALITY, mozjpeg: true })
                    .toBuffer();
                imageBuffer = compressedBuffer;
            }
            catch {
                try {
                    imageBuffer = await (0, sharp_1.default)(imageBuffer).jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer();
                }
                catch { }
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
        }
        catch (error) {
            if (error instanceof common_1.PayloadTooLargeException)
                throw error;
            return { success: false, message: '图片上传失败: ' + error.message };
        }
    }
    async uploadAudio(body) {
        try {
            if (!body.base64) {
                return { success: false, message: 'base64 数据不能为空' };
            }
            if (body.base64.length > 10 * 1024 * 1024 * 1.37) {
                throw new common_1.PayloadTooLargeException('音频过大（最大10MB）');
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
        }
        catch (error) {
            if (error instanceof common_1.PayloadTooLargeException)
                throw error;
            return { success: false, message: '音频上传失败: ' + error.message };
        }
    }
    getPublicDir() {
        const possiblePublicDirs = [
            path.join(process.cwd(), 'server', 'public'),
            path.join(process.cwd(), 'public'),
            path.join(process.cwd(), 'dist', 'public'),
            path.join(process.cwd(), 'server', 'dist', 'public'),
            path.join(__dirname, '..', '..', '..', '..', 'public'),
            path.join(__dirname, '..', '..', '..', 'public'),
        ];
        for (const dir of possiblePublicDirs) {
            if (fs.existsSync(dir))
                return dir;
        }
        const firstDir = possiblePublicDirs[0];
        fs.mkdirSync(firstDir, { recursive: true });
        return firstDir;
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)('image'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadImage", null);
__decorate([
    (0, common_1.Post)('audio'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadAudio", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('api/upload')
], UploadController);
//# sourceMappingURL=upload.controller.js.map