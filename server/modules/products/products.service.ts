import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { products, productCategories, users, mallOrders } from '@server/database/schema';
import { eq, and, count, desc, asc, ilike, sql, inArray } from 'drizzle-orm';
import type { ProductInfo, ProductListResponse, ProductCategoryInfo } from '@shared/api.interface';

interface ProductListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  keyword?: string;
  price?: string;
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
  sellerId?: string;
  promotionFeeRate?: string;
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
  sellerId?: string;
  promotionFeeRate?: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 根据卖家ID解析卖家昵称（冗余存入 products.sellerName，便于列表直接展示）。
   * sellerId 为空表示平台自营，返回 null。
   */
  private async resolveSellerName(sellerId?: string | null): Promise<string | null> {
    if (!sellerId) return null;
    const rows = await this.db
      .select({ nickname: users.nickname })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1);
    return rows[0]?.nickname ?? null;
  }

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
    if (params.price) {
      // 升级任务模式：按金额精确过滤（numeric 比较，兼容 200 / 200.00）
      conditions.push(sql`${products.price}::numeric = ${params.price}::numeric`);
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
          sellerId: products.sellerId,
          sellerName: products.sellerName,
          promotionFeeRate: products.promotionFeeRate,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(whereClause)
        .orderBy(desc(sql`COALESCE((SELECT max(mo._created_at) FROM mall_orders mo WHERE mo.product_id = ${products.id} AND mo.status IN ('pending_shipment','pending_delivery','completed')), ${products.createdAt})`))
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
      sellerId: item.sellerId ?? undefined,
      sellerName: item.sellerName ?? undefined,
      promotionFeeRate: String(item.promotionFeeRate ?? '0.08'),
      createdAt: item.createdAt.toISOString(),
    }));

    // 批量查询当前页商品已售件数（已付款确认：待发货+待收货+已完成）
    const productIds = itemsRaw.map((item) => item.id);
    const salesMap: Record<string, number> = {};
    if (productIds.length > 0) {
      const salesRows = await this.db
        .select({ productId: mallOrders.productId, cnt: count() })
        .from(mallOrders)
        .where(and(
          inArray(mallOrders.productId, productIds),
          inArray(mallOrders.status, ['pending_shipment', 'pending_delivery', 'completed']),
        ))
        .groupBy(mallOrders.productId);
      for (const row of salesRows) salesMap[row.productId] = Number(row.cnt);
    }
    for (const item of items) item.sales = salesMap[item.id] ?? 0;

    return { items, total, page, pageSize };
  }

  /** 商品详情：含全部图片 */
  async getProductDetail(id: string): Promise<ProductInfo> {
    const result = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    if (result.length === 0) {
      throw new NotFoundException('商品不存在');
    }
    const p = result[0];
    const productInfo: ProductInfo = {
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
      sellerId: p.sellerId ?? undefined,
      sellerName: p.sellerName ?? undefined,
      promotionFeeRate: String(p.promotionFeeRate),
      sales: 0,
      createdAt: p.createdAt.toISOString(),
    };
    const salesRows = await this.db
      .select({ cnt: count() })
      .from(mallOrders)
      .where(and(
        eq(mallOrders.productId, id),
        inArray(mallOrders.status, ['pending_shipment', 'pending_delivery', 'completed']),
      ));
    productInfo.sales = Number(salesRows[0]?.cnt ?? 0);
    return productInfo;
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
      sellerId: (item as any).sellerId ?? undefined,
      sellerName: (item as any).sellerName ?? undefined,
      promotionFeeRate: String((item as any).promotionFeeRate ?? '0.08'),
      createdAt: item.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  /** 后台创建商品 */
  async createProduct(dto: CreateProductDTO): Promise<ProductInfo> {
    const sellerId = (dto as any).sellerId ?? null;
    const sellerName = await this.resolveSellerName(sellerId);
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
        sellerId,
        sellerName,
        promotionFeeRate: (dto as any).promotionFeeRate ?? '0.08',
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
      sellerId: p.sellerId ?? undefined,
      sellerName: p.sellerName ?? undefined,
      promotionFeeRate: String(p.promotionFeeRate),
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
    if ((dto as any).sellerId !== undefined) {
      (patch as any).sellerId = (dto as any).sellerId;
      (patch as any).sellerName = await this.resolveSellerName((dto as any).sellerId);
    }
    if ((dto as any).promotionFeeRate !== undefined) (patch as any).promotionFeeRate = (dto as any).promotionFeeRate;

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
      sellerId: p.sellerId ?? undefined,
      sellerName: p.sellerName ?? undefined,
      promotionFeeRate: String(p.promotionFeeRate),
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

  /** 物理删除商品（订单表无外键约束，不影响历史订单快照） */
  async deleteProduct(id: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (existing.length === 0) {
      throw new NotFoundException('商品不存在');
    }
    await this.db.delete(products).where(eq(products.id, id));
    return { success: true };
  }
}
