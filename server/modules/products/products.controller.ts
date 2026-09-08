import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import type {
  ProductListResponse,
  ProductInfo,
  ProductCategoryInfo,
} from '@shared/api.interface';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** 商品分类列表（静态路由放动态路由前面） */
  @Get('categories')
  async getCategories(): Promise<ProductCategoryInfo[]> {
    return this.productsService.getCategories();
  }

  /** 商品列表（仅上架） */
  @Get()
  async getProductList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('keyword') keyword?: string,
  ): Promise<ProductListResponse> {
    return this.productsService.getProductList({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      category,
      keyword,
    });
  }

  /** 商品详情 */
  @Get(':id')
  async getProductDetail(@Param('id') id: string): Promise<ProductInfo> {
    return this.productsService.getProductDetail(id);
  }
}
