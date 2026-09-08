import type { Request } from 'express';
import { AdminService } from './admin.service';
import type { ProductListResponse, ProductInfo, MallOrderListResponse, MallOrderInfo, ConsultOrderListResponse, UserInfo, PlatformQrcodeInfo, ReviewDTO, ShipDTO } from '@shared/api.interface';
interface CreateProductBody {
    name: string;
    price: string;
    description?: string;
    category?: string;
    spec?: string;
    mainImages: {
        url: string;
    }[];
    detailImages: {
        url: string;
    }[];
    sortOrder?: number;
}
interface UpdateProductBody {
    name?: string;
    price?: string;
    description?: string;
    category?: string;
    spec?: string;
    mainImages?: {
        url: string;
    }[];
    detailImages?: {
        url: string;
    }[];
    status?: string;
    sortOrder?: number;
}
interface QrcodeUpdateBody {
    wechatQrcodeUrl?: string;
    alipayQrcodeUrl?: string;
}
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getProductList(page?: string, pageSize?: string, category?: string, keyword?: string, status?: string): Promise<ProductListResponse>;
    createProduct(req: Request, body: CreateProductBody): Promise<ProductInfo>;
    updateProduct(req: Request, id: string, body: UpdateProductBody): Promise<ProductInfo>;
    toggleProductStatus(req: Request, id: string): Promise<ProductInfo>;
    getMallOrderList(page?: string, pageSize?: string, status?: string): Promise<MallOrderListResponse>;
    reviewMallOrderPayment(id: string, dto: ReviewDTO): Promise<MallOrderInfo>;
    shipMallOrder(id: string, dto: ShipDTO): Promise<MallOrderInfo>;
    cancelMallOrder(id: string): Promise<MallOrderInfo>;
    getUserList(page?: string, pageSize?: string, level?: string, keyword?: string): Promise<{
        items: UserInfo[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getUserDetail(id: string): Promise<UserInfo>;
    getCompanyAuditList(page?: string, pageSize?: string): Promise<{
        items: UserInfo[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    reviewCompanyAudit(id: string, dto: ReviewDTO): Promise<UserInfo>;
    getPlatformQrcode(type: string): Promise<PlatformQrcodeInfo>;
    updatePlatformQrcode(type: string, body: QrcodeUpdateBody): Promise<PlatformQrcodeInfo>;
    getConsultOrderList(page?: string, pageSize?: string, status?: string): Promise<ConsultOrderListResponse>;
}
export {};
