import type { Request } from 'express';
import { SellersService } from './sellers.service';
import type { ProductInfo, ProductListResponse, MallOrderInfo, MallOrderListResponse, ManagementFeeInfo, ManagementFeeListResponse, SellerStatsInfo, SellerApplyDTO, ShipDTO } from '../../../shared/api.interface';
interface SellerProductBody {
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
    sellerWechatQrcodeUrl?: string;
    sellerAlipayQrcodeUrl?: string;
}
interface UpdateSellerProductBody {
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
    sortOrder?: number;
    sellerWechatQrcodeUrl?: string;
    sellerAlipayQrcodeUrl?: string;
}
interface PayFeeBody {
    screenshotUrl: string;
}
export declare class SellersController {
    private readonly sellersService;
    constructor(sellersService: SellersService);
    private sellerId;
    getProducts(req: Request, page?: string, pageSize?: string, status?: string): Promise<ProductListResponse>;
    createProduct(req: Request, body: SellerProductBody): Promise<ProductInfo>;
    updateProduct(req: Request, id: string, body: UpdateSellerProductBody): Promise<ProductInfo>;
    toggleProductStatus(req: Request, id: string): Promise<ProductInfo>;
    getOrders(req: Request, page?: string, pageSize?: string, status?: string): Promise<MallOrderListResponse>;
    shipOrder(req: Request, id: string, dto: ShipDTO): Promise<MallOrderInfo>;
    getManagementFees(req: Request, page?: string, pageSize?: string, status?: string): Promise<ManagementFeeListResponse>;
    payManagementFee(req: Request, id: string, body: PayFeeBody): Promise<ManagementFeeInfo>;
    getStats(req: Request): Promise<SellerStatsInfo>;
    apply(req: Request, dto: SellerApplyDTO): Promise<{
        success: boolean;
        sellerStatus: string;
    }>;
}
export {};
