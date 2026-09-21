import type { Request } from 'express';
import { AdminService } from './admin.service';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ProductListResponse, ProductInfo, MallOrderListResponse, MallOrderInfo, ConsultOrderListResponse, UserInfo, PlatformQrcodeInfo, ReviewDTO, ShipDTO } from '../../../shared/api.interface';
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
    private readonly db;
    constructor(adminService: AdminService, db: PostgresJsDatabase);
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
    resetUpgradeTasks(req: Request): Promise<{
        success: boolean;
        deletedCount: number;
        deleted: {
            id: string;
            userId: string;
            taskIndex: number;
            title: string;
        }[];
    }>;
    updateUserPhone(req: Request, id: string, body: {
        phone: string;
    }): Promise<UserInfo>;
    batchDeleteUsers(req: Request, body: {
        keepPhones?: string[];
        deleteUserIds?: string[];
    }): Promise<{
        success: boolean;
        deletedCount: number;
        users: any[];
        deletedUsers?: undefined;
    } | {
        success: boolean;
        deletedCount: number;
        deletedUsers: {
            id: string;
            phone: string;
            nickname: string;
        }[];
        users?: undefined;
    }>;
    getSellerList(req: Request, status?: string): Promise<{
        success: boolean;
        sellers: {
            id: string;
            phone: string;
            nickname: string;
            password: string;
            avatarUrl: string;
            gender: string;
            age: number;
            level: string;
            isInvited: boolean;
            inviterId: string;
            parentId: string;
            inviteCode: string;
            receiveAddress: string;
            receivePhone: string;
            industry: string;
            consultantLevel: string;
            qualification: string;
            serviceStandard: string;
            serviceIntroduction: string;
            realName: string;
            wechatId: string;
            idCardFrontUrl: string;
            idCardBackUrl: string;
            idCardNumber: string;
            address: string;
            wechatQrcodeUrl: string;
            alipayQrcodeUrl: string;
            companyQrcodeUrl: string;
            businessLicenseUrl: string;
            companyAuditStatus: string;
            totalConsultIncome: string;
            thresholdBlocked: boolean;
            thresholdTriggeredAt: Date;
            pendingReclaimAmount: string;
            overflowLossAmount: string;
            directInviteCount: number;
            teamTotalCount: number;
            treeLevel: number;
            isSeller: boolean;
            sellerStatus: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
    auditSeller(req: Request, id: string, body: any): Promise<{
        success: boolean;
        message: string;
        sellerStatus?: undefined;
    } | {
        success: boolean;
        sellerStatus: string;
        message: string;
    }>;
}
export {};
