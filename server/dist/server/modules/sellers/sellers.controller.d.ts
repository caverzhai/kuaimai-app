import { SellersService } from './sellers.service';
export declare class SellersController {
    private readonly sellersService;
    constructor(sellersService: SellersService);
    private sellerId;
    getProducts(req: any, page?: string, pageSize?: string, status?: string): Promise<{
        items: any;
        total: number;
        page: number;
        pageSize: number;
    }>;
    createProduct(req: any, body: any): Promise<{
        success: boolean;
        message: string;
    }>;
    updateProduct(req: any, id: string, body: any): Promise<{
        success: boolean;
        message: string;
    }>;
    toggleProductStatus(req: any, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getOrders(req: any, page?: string, pageSize?: string, status?: string): Promise<{
        items: any;
        total: number;
        page: number;
        pageSize: number;
    }>;
    shipOrder(req: any, id: string, dto: any): Promise<{
        id: any;
        orderNo: any;
        userId: any;
        productId: any;
        productName: any;
        productImage: any;
        price: string;
        quantity: any;
        totalAmount: string;
        receiveName: any;
        receivePhone: any;
        receiveAddress: any;
        sellerId: any;
        sellerName: any;
        status: any;
        paymentScreenshotUrl: any;
        paymentConfirmedAt: any;
        logisticsCompany: any;
        logisticsNo: any;
        shippedAt: any;
        deliveredAt: any;
        cancelReason: any;
        cancelledAt: any;
        autoConfirmDeadline: any;
        autoDeliveryDeadline: any;
        createdAt: any;
    }>;
    getManagementFees(req: any, page?: string, pageSize?: string, status?: string): Promise<{
        items: any;
        total: number;
        page: number;
        pageSize: number;
    }>;
    payManagementFee(req: any, id: string, body: any): Promise<{
        id: any;
        sellerId: any;
        sellerName: any;
        feeDate: any;
        totalSales: string;
        feeAmount: string;
        status: any;
        paymentScreenshotUrl: any;
        paidAt: any;
        confirmedBy: any;
        confirmedAt: any;
        deadline: any;
        createdAt: any;
    }>;
    getStats(req: any): Promise<{
        totalProducts: number;
        onSaleProducts: number;
        todaySales: string;
        todayOrders: number;
        pendingFees: string;
        pendingFeeCount: number;
        totalSalesAll: string;
    }>;
    apply(req: any, dto: any): Promise<{
        success: boolean;
        sellerStatus: "approved";
    } | {
        success: boolean;
        sellerStatus: "pending";
    }>;
}
