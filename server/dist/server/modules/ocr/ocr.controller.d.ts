import { OcrService } from './ocr.service';
export declare class OcrController {
    private readonly ocrService;
    constructor(ocrService: OcrService);
    recognizeIdCard(body: {
        imageUrl: string;
        cardType?: 'face' | 'back';
    }, req: any): Promise<{
        success: boolean;
        data: {
            name: any;
            gender: any;
            ethnicity: any;
            birthDate: any;
            address: any;
            idNumber: any;
            issueAuthority?: undefined;
            validPeriod?: undefined;
        } | {
            issueAuthority: any;
            validPeriod: any;
            name?: undefined;
            gender?: undefined;
            ethnicity?: undefined;
            birthDate?: undefined;
            address?: undefined;
            idNumber?: undefined;
        };
        raw: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
        raw?: undefined;
    }>;
}
