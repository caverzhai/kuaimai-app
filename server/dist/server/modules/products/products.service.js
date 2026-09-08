"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const schema_1 = require("@server/database/schema");
const drizzle_orm_1 = require("drizzle-orm");
let ProductsService = ProductsService_1 = class ProductsService {
    db;
    logger = new common_1.Logger(ProductsService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getProductList(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const offset = (page - 1) * pageSize;
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.products.status, 'on_sale')];
        if (params.category) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.products.category, params.category));
        }
        if (params.keyword) {
            conditions.push((0, drizzle_orm_1.ilike)(schema_1.products.name, `%${params.keyword}%`));
        }
        const whereClause = (0, drizzle_orm_1.and)(...conditions);
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.products).where(whereClause),
            this.db
                .select({
                id: schema_1.products.id,
                name: schema_1.products.name,
                price: schema_1.products.price,
                description: schema_1.products.description,
                category: schema_1.products.category,
                spec: schema_1.products.spec,
                mainImages: schema_1.products.mainImages,
                status: schema_1.products.status,
                createdAt: schema_1.products.createdAt,
            })
                .from(schema_1.products)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.asc)(schema_1.products.sortOrder), (0, drizzle_orm_1.desc)(schema_1.products.createdAt))
                .limit(pageSize)
                .offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        const items = itemsRaw.map((item) => ({
            id: item.id,
            name: item.name,
            price: String(item.price),
            description: item.description ?? undefined,
            category: item.category ?? undefined,
            spec: item.spec ?? undefined,
            mainImages: item.mainImages.slice(0, 1),
            detailImages: [],
            status: item.status,
            sortOrder: 0,
            createdAt: item.createdAt.toISOString(),
        }));
        return { items, total, page, pageSize };
    }
    async getProductDetail(id) {
        const result = await this.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, id)).limit(1);
        if (result.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const p = result[0];
        return {
            id: p.id,
            name: p.name,
            price: String(p.price),
            description: p.description ?? undefined,
            category: p.category ?? undefined,
            spec: p.spec ?? undefined,
            mainImages: p.mainImages,
            detailImages: p.detailImages,
            status: p.status,
            sortOrder: p.sortOrder,
            createdAt: p.createdAt.toISOString(),
        };
    }
    async getCategories() {
        const rows = await this.db
            .select({ id: schema_1.productCategories.id, name: schema_1.productCategories.name, sortOrder: schema_1.productCategories.sortOrder })
            .from(schema_1.productCategories)
            .orderBy((0, drizzle_orm_1.asc)(schema_1.productCategories.sortOrder));
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            sortOrder: row.sortOrder,
        }));
    }
    async getAdminProductList(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const offset = (page - 1) * pageSize;
        const conditions = [];
        if (params.category)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.products.category, params.category));
        if (params.keyword)
            conditions.push((0, drizzle_orm_1.ilike)(schema_1.products.name, `%${params.keyword}%`));
        if (params.status)
            conditions.push((0, drizzle_orm_1.eq)(schema_1.products.status, params.status));
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const baseQuery = whereClause
            ? this.db.select().from(schema_1.products).where(whereClause)
            : this.db.select().from(schema_1.products);
        const [countResult, itemsRaw] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.products).where(whereClause),
            baseQuery.orderBy((0, drizzle_orm_1.asc)(schema_1.products.sortOrder), (0, drizzle_orm_1.desc)(schema_1.products.createdAt)).limit(pageSize).offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        const items = itemsRaw.map((item) => ({
            id: item.id,
            name: item.name,
            price: String(item.price),
            description: item.description ?? undefined,
            category: item.category ?? undefined,
            spec: item.spec ?? undefined,
            mainImages: item.mainImages,
            detailImages: item.detailImages,
            status: item.status,
            sortOrder: item.sortOrder,
            createdAt: item.createdAt.toISOString(),
        }));
        return { items, total, page, pageSize };
    }
    async createProduct(dto) {
        const inserted = await this.db
            .insert(schema_1.products)
            .values({
            name: dto.name,
            price: dto.price,
            description: dto.description ?? null,
            category: dto.category ?? null,
            spec: dto.spec ?? null,
            mainImages: dto.mainImages,
            detailImages: dto.detailImages,
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
            mainImages: p.mainImages,
            detailImages: p.detailImages,
            status: p.status,
            sortOrder: p.sortOrder,
            createdAt: p.createdAt.toISOString(),
        };
    }
    async updateProduct(id, dto) {
        const patch = {};
        if (dto.name !== undefined)
            patch.name = dto.name;
        if (dto.price !== undefined)
            patch.price = dto.price;
        if (dto.description !== undefined)
            patch.description = dto.description;
        if (dto.category !== undefined)
            patch.category = dto.category;
        if (dto.spec !== undefined)
            patch.spec = dto.spec;
        if (dto.mainImages !== undefined) {
            patch.mainImages = dto.mainImages;
        }
        if (dto.detailImages !== undefined) {
            patch.detailImages = dto.detailImages;
        }
        if (dto.status !== undefined)
            patch.status = dto.status;
        if (dto.sortOrder !== undefined)
            patch.sortOrder = dto.sortOrder;
        if (Object.keys(patch).length === 0) {
            return this.getProductDetail(id);
        }
        const updated = await this.db.update(schema_1.products).set(patch).where((0, drizzle_orm_1.eq)(schema_1.products.id, id)).returning();
        if (updated.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const p = updated[0];
        return {
            id: p.id,
            name: p.name,
            price: String(p.price),
            description: p.description ?? undefined,
            category: p.category ?? undefined,
            spec: p.spec ?? undefined,
            mainImages: p.mainImages,
            detailImages: p.detailImages,
            status: p.status,
            sortOrder: p.sortOrder,
            createdAt: p.createdAt.toISOString(),
        };
    }
    async updateProductStatus(id, status) {
        const updated = await this.db
            .update(schema_1.products)
            .set({ status })
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id))
            .returning({ id: schema_1.products.id });
        if (updated.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        return this.getProductDetail(id);
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], ProductsService);
//# sourceMappingURL=products.service.js.map