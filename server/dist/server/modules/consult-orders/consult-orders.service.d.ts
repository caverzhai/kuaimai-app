import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ConsultOrderInfo, CreateConsultOrderDTO, ConsultOrderListResponse, PaymentScreenshotDTO, WorkScreenshotDTO, ReviewDTO } from '@shared/api.interface';
import { UpgradeService } from '../upgrade/upgrade.service';
export declare class ConsultOrdersService {
    private readonly db;
    private readonly upgradeService;
    private readonly logger;
    constructor(db: PostgresJsDatabase, upgradeService: UpgradeService);
    private toOrderInfo;
    private toUserBrief;
    getDistanceBetween(studentId: string, consultantId: string): Promise<number | null>;
    create(studentId: string, isInvited: boolean, dto: CreateConsultOrderDTO): Promise<ConsultOrderInfo>;
    getStudentOrders(studentId: string, page: number, pageSize: number, status?: string): Promise<ConsultOrderListResponse>;
    getConsultantOrders(consultantId: string, page: number, pageSize: number, status?: string): Promise<ConsultOrderListResponse>;
    getOrderDetail(userId: string, id: string): Promise<ConsultOrderInfo>;
    uploadPaymentScreenshot(userId: string, id: string, dto: PaymentScreenshotDTO): Promise<ConsultOrderInfo>;
    confirmPayment(userId: string, id: string): Promise<ConsultOrderInfo>;
    uploadWork(userId: string, id: string, dto: WorkScreenshotDTO): Promise<ConsultOrderInfo>;
    reviewWork(userId: string, id: string, dto: ReviewDTO): Promise<ConsultOrderInfo>;
}
