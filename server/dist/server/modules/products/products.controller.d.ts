import { ProductsService } from './products.service';
import type { ProductListResponse, ProductInfo, ProductCategoryInfo } from '@shared/api.interface';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    getCategories(): Promise<ProductCategoryInfo[]>;
    getProductList(page?: string, pageSize?: string, category?: string, keyword?: string): Promise<ProductListResponse>;
    getProductDetail(id: string): Promise<ProductInfo>;
}
