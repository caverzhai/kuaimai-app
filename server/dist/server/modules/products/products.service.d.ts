import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ProductInfo, ProductListResponse, ProductCategoryInfo } from '@shared/api.interface';
interface ProductListParams {
    page?: number;
    pageSize?: number;
    category?: string;
    keyword?: string;
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
    status?: string;
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
export declare class ProductsService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    getProductList(params: ProductListParams): Promise<ProductListResponse>;
    getProductDetail(id: string): Promise<ProductInfo>;
    getCategories(): Promise<ProductCategoryInfo[]>;
    getAdminProductList(params: ProductListParams & {
        status?: string;
    }): Promise<ProductListResponse>;
    createProduct(dto: CreateProductDTO): Promise<ProductInfo>;
    updateProduct(id: string, dto: UpdateProductDTO): Promise<ProductInfo>;
    updateProductStatus(id: string, status: string): Promise<ProductInfo>;
}
export {};
