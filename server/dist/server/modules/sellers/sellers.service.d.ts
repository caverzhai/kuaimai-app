export declare class SellersService {
    private readonly db;
    private readonly logger;
    constructor(db: any);
    assertApprovedSeller(userId: string): Promise<any>;
    private beijingNow;
    private bjMidnight;
    private toProductInfo;
    private toOrderInfo;
    private toFeeInfo;
    getSellerProducts(sellerId: string, page: number, pageSize: number, status?: string): Promise<{
        items: any;
        total: number;
        page: number;
        pageSize: number;
    }>;
    createSellerProduct(sellerId: string, dto: any): Promise<{
        id: any;
        name: any;
        price: string;
        description: any;
        category: any;
        spec: any;
        sellerId: any;
        sellerName: any;
        sellerWechatQrcodeUrl: any;
        sellerAlipayQrcodeUrl: any;
        mainImages: any;
        detailImages: any;
        status: any;
        sortOrder: any;
        createdAt: any;
    }>;
    updateSellerProduct(sellerId: string, productId: string, dto: any): Promise<{
        id: any;
        name: any;
        price: string;
        description: any;
        category: any;
        spec: any;
        sellerId: any;
        sellerName: any;
        sellerWechatQrcodeUrl: any;
        sellerAlipayQrcodeUrl: any;
        mainImages: any;
        detailImages: any;
        status: any;
        sortOrder: any;
        createdAt: any;
    }>;
    toggleSellerProductStatus(sellerId: string, productId: string): Promise<{
        id: any;
        name: any;
        price: string;
        description: any;
        category: any;
        spec: any;
        sellerId: any;
        sellerName: any;
        sellerWechatQrcodeUrl: any;
        sellerAlipayQrcodeUrl: any;
        mainImages: any;
        detailImages: any;
        status: any;
        sortOrder: any;
        createdAt: any;
    }>;
    getSellerOrders(sellerId: string, page: number, pageSize: number, status?: string): Promise<{
        items: any;
        total: number;
        page: number;
        pageSize: number;
    }>;
    sellerShipOrder(sellerId: string, orderId: string, dto: any): Promise<{
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
    getSellerManagementFees(sellerId: string, page: number, pageSize: number, status?: string): Promise<{
        items: any;
        total: number;
        page: number;
        pageSize: number;
    }>;
    payManagementFee(sellerId: string, feeId: string, screenshotUrl: string): Promise<{
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
    generateDailyManagementFees(): Promise<{
        generatedCount: number;
        feeDate: string;
    }>;
    autoWarehouseOverdueFees(): Promise<{
        warehouseCount: number;
    }>;
    getSellerStats(sellerId: string): Promise<{
        totalProducts: number;
        onSaleProducts: number;
        todaySales: string;
        todayOrders: number;
        pendingFees: string;
        pendingFeeCount: number;
        totalSalesAll: string;
    }>;
    applySeller(userId: string, dto: any): Promise<{
        success: boolean;
        sellerStatus: "approved";
    } | {
        success: boolean;
        sellerStatus: "pending";
    }>;
}
