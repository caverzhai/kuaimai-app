interface UploadImageBody {
    base64: string;
    filename?: string;
}
export declare class UploadController {
    debug(): Promise<{
        success: boolean;
        info: any;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        info?: undefined;
    }>;
    uploadImage(body: UploadImageBody): Promise<{
        success: boolean;
        message: string;
        url?: undefined;
        filename?: undefined;
        size?: undefined;
    } | {
        success: boolean;
        url: string;
        filename: string;
        size: number;
        message?: undefined;
    }>;
}
export {};
