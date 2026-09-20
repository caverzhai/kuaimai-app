import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ProductInfo, ProductListResponse, MallOrderInfo, MallOrderListResponse, ManagementFeeInfo, ManagementFeeListResponse, SellerStatsInfo, SellerApplyDTO, ShipDTO } from '../../../shared/api.interface';
interface SellerProductDTO {
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
interface UpdateSellerProductDTO {
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
export declare class SellersService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    private assertApprovedSeller;
    private toProductInfo;
    private toFeeInfo;
    private beijingNow;
    private bjMidnight;
    getSellerProducts(sellerId: string, page: number, pageSize: number, status?: string): Promise<ProductListResponse>;
    createSellerProduct(sellerId: string, dto: SellerProductDTO): Promise<ProductInfo>;
    updateSellerProduct(sellerId: string, productId: string, dto: UpdateSellerProductDTO): Promise<ProductInfo>;
    toggleSellerProductStatus(sellerId: string, productId: string): Promise<ProductInfo>;
    getSellerOrders(sellerId: string, page: number, pageSize: number, status?: string): Promise<MallOrderListResponse>;
    sellerShipOrder(sellerId: string, orderId: string, dto: ShipDTO): Promise<MallOrderInfo>;
    private toOrderInfo;
    getSellerManagementFees(sellerId: string, page: number, pageSize: number, status?: string): Promise<ManagementFeeListResponse>;
    payManagementFee(sellerId: string, feeId: string, screenshotUrl: string): Promise<ManagementFeeInfo>;
    getSellerStats(sellerId: string): Promise<SellerStatsInfo>;
    applySeller(userId: string, dto: SellerApplyDTO): Promise<{
        success: boolean;
        sellerStatus: string;
    }>;
}
export {};
