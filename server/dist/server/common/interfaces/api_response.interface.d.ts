export interface ApiErrorResponse {
    error: {
        code: string;
        message: string;
        details?: string;
        fieldErrors?: Record<string, string[]>;
        stack?: string;
        cause?: string;
        timestamp?: number;
    };
}
