import type { SqliteDb } from '../db/database.js';
import { runInTransaction } from '../db/database.js';
import type {
  BomLineInput,
  CreateProductInput,
  Product,
  UpdateProductInput,
} from '../domain/types.js';
import { ActivityRepository } from '../repositories/activity.repo.js';
import { MaterialRepository } from '../repositories/material.repo.js';
import { ProductRepository } from '../repositories/product.repo.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

export class ProductService {
  private readonly productRepo: ProductRepository;
  private readonly materialRepo: MaterialRepository;
  private readonly activityRepo: ActivityRepository;

  constructor(private readonly db: SqliteDb) {
    this.productRepo = new ProductRepository(db);
    this.materialRepo = new MaterialRepository(db);
    this.activityRepo = new ActivityRepository(db);
  }

  listProducts(): Product[] {
    return this.productRepo.findAll();
  }

  getProduct(id: number): Product {
    const product = this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError(`Product #${id} not found`);
    }
    return product;
  }

  private validateBomLines(bom: BomLineInput[]): void {
    if (bom.length === 0) {
      throw new ValidationError('Bill of materials must contain at least one material');
    }

    const seenIds = new Set<number>();
    for (const line of bom) {
      if (seenIds.has(line.materialId)) {
        throw new ValidationError('Bill of materials cannot contain duplicate materials');
      }
      seenIds.add(line.materialId);
    }

    const materials = this.materialRepo.findByIds(Array.from(seenIds));
    if (materials.length !== seenIds.size) {
      const foundIds = new Set(materials.map((m) => m.id));
      const missingIds = Array.from(seenIds).filter((id) => !foundIds.has(id));
      throw new ValidationError(
        `Referenced material(s) not found: ${missingIds.join(', ')}`
      );
    }
  }

  createProduct(input: CreateProductInput): Product {
    if (this.productRepo.findByName(input.name)) {
      throw new ConflictError(`A product named "${input.name.trim()}" already exists`);
    }
    if (input.sku && input.sku.trim() && this.productRepo.findBySku(input.sku)) {
      throw new ConflictError(`A product with SKU "${input.sku.trim()}" already exists`);
    }

    this.validateBomLines(input.bom);

    return runInTransaction(this.db, () => {
      const created = this.productRepo.create(input);
      this.activityRepo.log(
        'product_created',
        'product',
        created.id,
        `Created product "${created.name}" (${created.bom.length} BOM materials)`
      );
      return created;
    });
  }

  updateProduct(id: number, input: UpdateProductInput): Product {
    this.getProduct(id);

    if (input.name !== undefined) {
      const duplicate = this.productRepo.findByName(input.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`A product named "${input.name.trim()}" already exists`);
      }
    }
    if (input.sku !== undefined && input.sku && input.sku.trim()) {
      const duplicateSku = this.productRepo.findBySku(input.sku);
      if (duplicateSku && duplicateSku.id !== id) {
        throw new ConflictError(`A product with SKU "${input.sku.trim()}" already exists`);
      }
    }
    if (input.bom !== undefined) {
      this.validateBomLines(input.bom);
    }

    return runInTransaction(this.db, () => {
      const updated = this.productRepo.update(id, input)!;
      this.activityRepo.log(
        'product_updated',
        'product',
        updated.id,
        `Updated product "${updated.name}"`
      );
      return updated;
    });
  }

  deleteProduct(id: number): void {
    const existing = this.getProduct(id);
    if (this.productRepo.hasOrders(id)) {
      throw new ConflictError(
        `Cannot delete "${existing.name}" because it has existing production orders`
      );
    }

    runInTransaction(this.db, () => {
      this.productRepo.delete(id);
      this.activityRepo.log(
        'product_deleted',
        'product',
        id,
        `Deleted product "${existing.name}"`
      );
    });
  }
}
