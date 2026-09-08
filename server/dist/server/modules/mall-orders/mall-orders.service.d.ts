import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { MallOrderInfo, CreateMallOrderDTO, MallOrderListResponse, PaymentScreenshotDTO } from '@shared/api.interface';
export declare class MallOrdersService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    private toOrderInfo;
    create(userId: string, dto: CreateMallOrderDTO): Promise<MallOrderInfo>;
    getMyOrders(userId: string, page: number, pageSize: number, status?: string): Promise<MallOrderListResponse>;
    getOrderDetail(userId: string, id: string): Promise<MallOrderInfo>;
    uploadPaymentScreenshot(userId: string, id: string, dto: PaymentScreenshotDTO): Promise<MallOrderInfo>;
    confirmDelivery(userId: string, id: string): Promise<MallOrderInfo>;
}
