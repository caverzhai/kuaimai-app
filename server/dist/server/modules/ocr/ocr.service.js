"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OcrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const https = require("https");
let OcrService = OcrService_1 = class OcrService {
    logger = new common_1.Logger(OcrService_1.name);
    accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
    accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
    endpoint = 'ocr-api.cn-hangzhou.aliyuncs.com';
    async recognizeIdCard(imageUrl, cardType = 'face') {
        try {
            this.logger.log(`开始识别身份证: ${imageUrl}, 类型: ${cardType}`);
            const params = {
                Action: 'RecognizeIdcard',
                Version: '2021-07-07',
                Format: 'JSON',
                AccessKeyId: this.accessKeyId,
                SignatureMethod: 'HMAC-SHA1',
                SignatureVersion: '1.0',
                SignatureNonce: crypto.randomUUID(),
                Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
                Url: imageUrl,
            };
            const sortedKeys = Object.keys(params).sort();
            const canonicalizedQuery = sortedKeys
                .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                .join('&');
            const stringToSign = `POST&%2F&${encodeURIComponent(canonicalizedQuery)}`;
            const signature = crypto
                .createHmac('sha1', this.accessKeySecret + '&')
                .update(stringToSign)
                .digest('base64');
            const requestUrl = `https://${this.endpoint}/?${canonicalizedQuery}&Signature=${encodeURIComponent(signature)}`;
            const result = await this.postRequest(requestUrl);
            this.logger.log(`OCR识别结果: ${JSON.stringify(result).substring(0, 500)}`);
            if (result && result.Data) {
                const data = JSON.parse(result.Data);
                return {
                    success: true,
                    data: this.parseIdCardResult(data, cardType),
                    raw: data,
                };
            }
            return { success: false, error: result?.Message || '识别结果为空' };
        }
        catch (error) {
            this.logger.error(`OCR识别失败: ${error.message}`);
            return {
                success: false,
                error: error.message || '识别失败',
            };
        }
    }
    postRequest(url) {
        return new Promise((resolve, reject) => {
            const data = '';
            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(data),
                },
            }, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    }
                    catch {
                        resolve(body);
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
    parseIdCardResult(data, cardType) {
        if (cardType === 'face') {
            const faceData = data?.data?.face?.data || data?.face?.data || data;
            return {
                name: faceData.name || '',
                gender: faceData.sex || faceData.gender || '',
                ethnicity: faceData.ethnicity || '',
                birthDate: faceData.birthDate || '',
                address: faceData.address || '',
                idNumber: faceData.idNumber || faceData.cardNumber || '',
            };
        }
        else {
            const backData = data?.data?.back?.data || data?.back?.data || data;
            return {
                issueAuthority: backData.issueAuthority || '',
                validPeriod: backData.validPeriod || '',
            };
        }
    }
};
exports.OcrService = OcrService;
exports.OcrService = OcrService = OcrService_1 = __decorate([
    (0, common_1.Injectable)()
], OcrService);
//# sourceMappingURL=ocr.service.js.map