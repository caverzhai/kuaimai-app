import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProductsService } from '@server/modules/products/products.service';
import { UpgradeService } from '@server/modules/upgrade/upgrade.service';
import type { ProductInfo, ProductListResponse, MallOrderInfo, MallOrderListResponse, ConsultOrderListResponse, UserInfo, PlatformQrcodeInfo, ReviewDTO, ShipDTO } from '@shared/api.interface';
interface AdminListParams {
    page?: number;
    pageSize?: number;
}
interface ProductListParams extends AdminListParams {
    category?: string;
    keyword?: string;
    status?: string;
}
interface CreateProductDTO {
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
interface UpdateProductDTO {
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
interface MallOrderListParams extends AdminListParams {
    status?: string;
}
interface UserListParams extends AdminListParams {
    level?: string;
    keyword?: string;
}
interface QrcodeUpdateDTO {
    wechatQrcodeUrl?: string;
    alipayQrcodeUrl?: string;
}
interface FinanceInfo {
    totalConsultIncome: string;
    pendingReclaimAmount: string;
    overflowLossAmount: string;
    thresholdBlocked: boolean;
    thresholdTriggeredAt?: string;
    directInviteCount: number;
    wechatQrcodeUrl?: string;
    alipayQrcodeUrl?: string;
    companyQrcodeUrl?: string;
    level: string;
}
export declare class AdminService {
    private readonly db;
    private readonly productsService;
    private readonly upgradeService;
    private readonly logger;
    constructor(db: PostgresJsDatabase, productsService: ProductsService, upgradeService: UpgradeService);
    getProductList(params: ProductListParams): Promise<ProductListResponse>;
    createProduct(dto: CreateProductDTO): Promise<ProductInfo>;
    updateProduct(id: string, dto: UpdateProductDTO): Promise<ProductInfo>;
    toggleProductStatus(id: string): Promise<ProductInfo>;
    private toMallOrderInfo;
    getMallOrderList(params: MallOrderListParams): Promise<MallOrderListResponse>;
    reviewMallOrderPayment(id: string, dto: ReviewDTO): Promise<MallOrderInfo>;
    shipMallOrder(id: string, dto: ShipDTO): Promise<MallOrderInfo>;
    cancelMallOrder(id: string): Promise<MallOrderInfo>;
    private toUserInfo;
    getUserList(params: UserListParams): Promise<{
        items: UserInfo[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getUserDetail(id: string): Promise<UserInfo>;
    getCompanyAuditList(params: AdminListParams): Promise<{
        items: UserInfo[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    reviewCompanyAudit(id: string, dto: ReviewDTO): Promise<UserInfo>;
    getPlatformQrcode(type: string): Promise<PlatformQrcodeInfo>;
    updatePlatformQrcode(type: string, dto: QrcodeUpdateDTO): Promise<PlatformQrcodeInfo>;
    private toConsultOrderInfo;
    getConsultOrderList(params: MallOrderListParams): Promise<ConsultOrderListResponse>;
    getFinanceInfo(userId: string): Promise<FinanceInfo>;
}
export {};
