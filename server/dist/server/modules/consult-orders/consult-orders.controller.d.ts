import type { Request } from 'express';
import { ConsultOrdersService } from './consult-orders.service';
import type { ConsultOrderInfo, CreateConsultOrderDTO, ConsultOrderListResponse, PaymentScreenshotDTO, WorkScreenshotDTO, ReviewDTO } from '@shared/api.interface';
export declare class ConsultOrdersController {
    private readonly consultOrdersService;
    constructor(consultOrdersService: ConsultOrdersService);
    create(req: Request, dto: CreateConsultOrderDTO): Promise<ConsultOrderInfo>;
    getMyOrders(req: Request, page?: string, pageSize?: string, status?: string): Promise<ConsultOrderListResponse>;
    getReceivedOrders(req: Request, page?: string, pageSize?: string, status?: string): Promise<ConsultOrderListResponse>;
    getDetail(req: Request, id: string): Promise<ConsultOrderInfo>;
    uploadPayment(req: Request, id: string, dto: PaymentScreenshotDTO): Promise<ConsultOrderInfo>;
    confirmPayment(req: Request, id: string): Promise<ConsultOrderInfo>;
    uploadWork(req: Request, id: string, dto: WorkScreenshotDTO): Promise<ConsultOrderInfo>;
    reviewWork(req: Request, id: string, dto: ReviewDTO): Promise<ConsultOrderInfo>;
}
