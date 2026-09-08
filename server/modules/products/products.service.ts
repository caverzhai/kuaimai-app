import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { products, productCategories } from '@server/database/schema';
import { eq, and, count, desc, asc, ilike, sql } from 'drizzle-orm';
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
  mainImages: { url: string }[];
  detailImages: { url: string }[];
  status?: string;
  sortOrder?: number;
}

interface UpdateProductDTO {
  name?: string;
  price?: string;
  description?: string;
  category?: string;
  spec?: string;
  mainImages?: { url: string }[];
  detailImages?: { url: string }[];
  status?: string;
  sortOrder?: number;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /** 前台商品列表：仅上架商品，支持分页、分类筛选、关键词搜索 */
  async getProductList(params: ProductListParams): Promise<ProductListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(products.status, 'on_sale')];
    if (params.category) {
      conditions.push(eq(products.category, params.category));
    }
    if (params.keyword) {
      conditions.push(ilike(products.name, `%${params.keyword}%`));
    }
    const whereClause = and(...conditions);

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(products).where(whereClause),
      this.db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          description: products.description,
          category: products.category,
          spec: products.spec,
          mainImages: products.mainImages,
          status: products.status,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(whereClause)
        .orderBy(asc(products.sortOrder), desc(products.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: ProductInfo[] = itemsRaw.map((item) => ({
      id: item.id,
      name: item.name,
      price: String(item.price),
      description: item.description ?? undefined,
      category: item.category ?? undefined,
      spec: item.spec ?? undefined,
      mainImages: (item.mainImages as { url: string }[]).slice(0, 1),
      detailImages: [],
      status: item.status,
      sortOrder: 0,
      createdAt: item.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  /** 商品详情：含全部图片 */
  async getProductDetail(id: string): Promise<ProductInfo> {
    const result = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    if (result.length === 0) {
      throw new NotFoundException('商品不存在');
    }
    const p = result[0];
    return {
      id: p.id,
      name: p.name,
      price: String(p.price),
      description: p.description ?? undefined,
      category: p.category ?? undefined,
      spec: p.spec ?? undefined,
      mainImages: p.mainImages as { url: string }[],
      detailImages: p.detailImages as { url: string }[],
      status: p.status,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
    };
  }

  /** 商品分类列表 */
  async getCategories(): Promise<ProductCategoryInfo[]> {
    const rows = await this.db
      .select({ id: productCategories.id, name: productCategories.name, sortOrder: productCategories.sortOrder })
      .from(productCategories)
      .orderBy(asc(productCategories.sortOrder));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
    }));
  }

  // ========== 后台管理方法（供 admin 模块调用） ==========

  /** 后台商品列表：含全部状态，支持筛选 */
  async getAdminProductList(params: ProductListParams & { status?: string }): Promise<ProductListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (params.category) conditions.push(eq(products.category, params.category));
    if (params.keyword) conditions.push(ilike(products.name, `%${params.keyword}%`));
    if (params.status) conditions.push(eq(products.status, params.status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = whereClause
      ? this.db.select().from(products).where(whereClause)
      : this.db.select().from(products);

    const [countResult, itemsRaw] = await Promise.all([
      this.db.select({ count: count() }).from(products).where(whereClause),
      baseQuery.orderBy(asc(products.sortOrder), desc(products.createdAt)).limit(pageSize).offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: ProductInfo[] = itemsRaw.map((item) => ({
      id: item.id,
      name: item.name,
      price: String(item.price),
      description: item.description ?? undefined,
      category: item.category ?? undefined,
      spec: item.spec ?? undefined,
      mainImages: item.mainImages as { url: string }[],
      detailImages: item.detailImages as { url: string }[],
      status: item.status,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  /** 后台创建商品 */
  async createProduct(dto: CreateProductDTO): Promise<ProductInfo> {
    const inserted = await this.db
      .insert(products)
      .values({
        name: dto.name,
        price: dto.price,
        description: dto.description ?? null,
        category: dto.category ?? null,
        spec: dto.spec ?? null,
        mainImages: dto.mainImages as unknown as string[],
        detailImages: dto.detailImages as unknown as string[],
        status: dto.status ?? 'on_sale',
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();

    const p = inserted[0];
    return {
      id: p.id,
      name: p.name,
      price: String(p.price),
      description: p.description ?? undefined,
      category: p.category ?? undefined,
      spec: p.spec ?? undefined,
      mainImages: p.mainImages as { url: string }[],
      detailImages: p.detailImages as { url: string }[],
      status: p.status,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
    };
  }

  /** 后台编辑商品 */
  async updateProduct(id: string, dto: UpdateProductDTO): Promise<ProductInfo> {
    const patch: Partial<typeof products.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.price !== undefined) patch.price = dto.price;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.spec !== undefined) patch.spec = dto.spec;
    if (dto.mainImages !== undefined) {
      patch.mainImages = dto.mainImages as unknown as typeof products.$inferInsert.mainImages;
    }
    if (dto.detailImages !== undefined) {
      patch.detailImages = dto.detailImages as unknown as typeof products.$inferInsert.detailImages;
    }
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    if (Object.keys(patch).length === 0) {
      return this.getProductDetail(id);
    }

    const updated = await this.db.update(products).set(patch).where(eq(products.id, id)).returning();
    if (updated.length === 0) {
      throw new NotFoundException('商品不存在');
    }

    const p = updated[0];
    return {
      id: p.id,
      name: p.name,
      price: String(p.price),
      description: p.description ?? undefined,
      category: p.category ?? undefined,
      spec: p.spec ?? undefined,
      mainImages: p.mainImages as { url: string }[],
      detailImages: p.detailImages as { url: string }[],
      status: p.status,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
    };
  }

  /** 后台上下架 */
  async updateProductStatus(id: string, status: string): Promise<ProductInfo> {
    const updated = await this.db
      .update(products)
      .set({ status })
      .where(eq(products.id, id))
      .returning({ id: products.id });
    if (updated.length === 0) {
      throw new NotFoundException('商品不存在');
    }
    return this.getProductDetail(id);
  }
}
