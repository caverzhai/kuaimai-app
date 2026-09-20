export declare class OcrService {
    private readonly logger;
    private accessKeyId;
    private accessKeySecret;
    private endpoint;
    recognizeIdCard(imageUrl: string, cardType?: 'face' | 'back'): Promise<{
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
    private postRequest;
    private parseIdCardResult;
}
