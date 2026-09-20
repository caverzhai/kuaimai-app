interface UploadImageBody {
    base64: string;
    filename?: string;
}
export declare class UploadController {
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
    uploadAudio(body: UploadImageBody): Promise<{
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
    private getPublicDir;
}
export {};
