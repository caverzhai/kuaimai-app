import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as https from 'https';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
  private accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
  private endpoint = 'ocr-api.cn-hangzhou.aliyuncs.com';

  async recognizeIdCard(imageUrl: string, cardType: 'face' | 'back' = 'face') {
    try {
      this.logger.log(`开始识别身份证: ${imageUrl}, 类型: ${cardType}`);

      // 构建请求参数（OCR文字识别 2021-07-07）
      const params: Record<string, string> = {
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

      // 排序参数
      const sortedKeys = Object.keys(params).sort();
      const canonicalizedQuery = sortedKeys
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');

      // 构造待签名字符串
      const stringToSign = `POST&%2F&${encodeURIComponent(canonicalizedQuery)}`;

      // 计算签名
      const signature = crypto
        .createHmac('sha1', this.accessKeySecret + '&')
        .update(stringToSign)
        .digest('base64');

      // 最终请求URL
      const requestUrl = `https://${this.endpoint}/?${canonicalizedQuery}&Signature=${encodeURIComponent(signature)}`;

      // 发送POST请求
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
    } catch (error: any) {
      this.logger.error(`OCR识别失败: ${error.message}`);
      return {
        success: false,
        error: error.message || '识别失败',
      };
    }
  }

  private postRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = '';
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(body);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private parseIdCardResult(data: any, cardType: string) {
    if (cardType === 'face') {
      // 新版API返回结构: data.face.data
      const faceData = data?.data?.face?.data || data?.face?.data || data;
      return {
        name: faceData.name || '',
        gender: faceData.sex || faceData.gender || '',
        ethnicity: faceData.ethnicity || '',
        birthDate: faceData.birthDate || '',
        address: faceData.address || '',
        idNumber: faceData.idNumber || faceData.cardNumber || '',
      };
    } else {
      const backData = data?.data?.back?.data || data?.back?.data || data;
      return {
        issueAuthority: backData.issueAuthority || '',
        validPeriod: backData.validPeriod || '',
      };
    }
  }
}
