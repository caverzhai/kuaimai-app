import type { Request } from 'express';
import { MallOrdersService } from './mall-orders.service';
import type { MallOrderInfo, CreateMallOrderDTO, MallOrderListResponse, PaymentScreenshotDTO } from '@shared/api.interface';
export declare class MallOrdersController {
    private readonly mallOrdersService;
    constructor(mallOrdersService: MallOrdersService);
    create(req: Request, dto: CreateMallOrderDTO): Promise<MallOrderInfo>;
    getMyOrders(req: Request, page?: string, pageSize?: string, status?: string): Promise<MallOrderListResponse>;
    getDetail(req: Request, id: string): Promise<MallOrderInfo>;
    uploadPayment(req: Request, id: string, dto: PaymentScreenshotDTO): Promise<MallOrderInfo>;
    confirmDelivery(req: Request, id: string): Promise<MallOrderInfo>;
}
