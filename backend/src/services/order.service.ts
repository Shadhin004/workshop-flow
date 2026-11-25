import type { SqliteDb } from '../db/database.js';
import { runInTransaction } from '../db/database.js';
import {
  computeDeductedStocks,
  evaluateStockAvailability,
  type MaterialStockSnapshot,
} from '../domain/stock.js';
import type {
  CreateOrderInput,
  OrderStatus,
  Product,
  ProductionOrder,
} from '../domain/types.js';
import { ActivityRepository } from '../repositories/activity.repo.js';
import { MaterialRepository } from '../repositories/material.repo.js';
import { OrderRepository, type OrderRecord } from '../repositories/order.repo.js';
import { ProductRepository } from '../repositories/product.repo.js';
import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';

export class OrderService {
  private readonly orderRepo: OrderRepository;
  private readonly productRepo: ProductRepository;
  private readonly materialRepo: MaterialRepository;
  private readonly activityRepo: ActivityRepository;

  constructor(private readonly db: SqliteDb) {
    this.orderRepo = new OrderRepository(db);
    this.productRepo = new ProductRepository(db);
    this.materialRepo = new MaterialRepository(db);
    this.activityRepo = new ActivityRepository(db);
  }

  private buildMaterialSnapshotMap(): Map<number, MaterialStockSnapshot> {
    const materials = this.materialRepo.findAll();
    const map = new Map<number, MaterialStockSnapshot>();
    for (const m of materials) {
      map.set(m.id, {
        id: m.id,
        name: m.name,
        unit: m.unit,
        stockQuantity: m.stockQuantity,
      });
    }
    return map;
  }

  private enrichOrder(
    record: OrderRecord,
    product: Product,
    materialMap: Map<number, MaterialStockSnapshot>
  ): ProductionOrder {
    const bomInput = product.bom.map((line) => ({
      materialId: line.materialId,
      quantityPerUnit: line.quantityPerUnit,
    }));

    const evaluation = evaluateStockAvailability(bomInput, record.quantity, materialMap);

    return {
      ...record,
      requirements: evaluation.requirements,
      canComplete: record.status === 'open' ? evaluation.canComplete : false,
      shortages: record.status === 'open' ? evaluation.shortages : [],
    };
  }

  listOrders(status?: OrderStatus): ProductionOrder[] {
    const records = this.orderRepo.findAll(status);
    if (records.length === 0) return [];

    const products = this.productRepo.findAll();
    const productById = new Map(products.map((p) => [p.id, p]));
    const materialMap = this.buildMaterialSnapshotMap();

    return records.map((record) => {
      const product = productById.get(record.productId);
      if (!product) {
        throw new NotFoundError(`Product #${record.productId} not found for order #${record.id}`);
      }
      return this.enrichOrder(record, product, materialMap);
    });
  }

  getOrder(id: number): ProductionOrder {
    const record = this.orderRepo.findById(id);
    if (!record) {
      throw new NotFoundError(`Production order #${id} not found`);
    }
    const product = this.productRepo.findById(record.productId);
    if (!product) {
      throw new NotFoundError(`Product #${record.productId} not found`);
    }
    return this.enrichOrder(record, product, this.buildMaterialSnapshotMap());
  }

  createOrder(input: CreateOrderInput): ProductionOrder {
    const product = this.productRepo.findById(input.productId);
    if (!product) {
      throw new NotFoundError(`Product #${input.productId} not found`);
    }
    if (product.bom.length === 0) {
      throw new ValidationError(
        `Product "${product.name}" has no bill of materials configured`
      );
    }

    const created = runInTransaction(this.db, () => {
      const record = this.orderRepo.create(input);
      this.activityRepo.log(
        'order_created',
        'order',
        record.id,
        `Created order #${record.id}: ${record.quantity} × ${product.name}`
      );
      return record;
    });

    return this.enrichOrder(created, product, this.buildMaterialSnapshotMap());
  }

  completeOrder(id: number): ProductionOrder {
    try {
      const completedRecord = runInTransaction(this.db, () => {
        const record = this.orderRepo.findById(id);
        if (!record) {
          throw new NotFoundError(`Production order #${id} not found`);
        }
        if (record.status !== 'open') {
          throw new ConflictError(
            `Order #${id} cannot be completed because its status is "${record.status}"`
          );
        }

        const product = this.productRepo.findById(record.productId);
        if (!product) {
          throw new NotFoundError(`Product #${record.productId} not found`);
        }

        const materialMap = this.buildMaterialSnapshotMap();
        const evaluation = evaluateStockAvailability(
          product.bom.map((b) => ({
            materialId: b.materialId,
            quantityPerUnit: b.quantityPerUnit,
          })),
          record.quantity,
          materialMap
        );

        if (!evaluation.canComplete) {
          throw new InsufficientStockError(evaluation.shortages);
        }

        const updates = computeDeductedStocks(evaluation.requirements);
        for (const update of updates) {
          this.materialRepo.updateStockQuantity(update.materialId, update.newStockQuantity);
        }

        const updatedOrder = this.orderRepo.markCompleted(id)!;
        this.activityRepo.log(
          'order_completed',
          'order',
          id,
          `Completed order #${id}: ${record.quantity} × ${product.name} (materials deducted)`
        );

        return updatedOrder;
      });

      const product = this.productRepo.findById(completedRecord.productId)!;
      return this.enrichOrder(completedRecord, product, this.buildMaterialSnapshotMap());
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        const record = this.orderRepo.findById(id);
        if (record) {
          const shortageSummary = err.shortages
            .map((s) => `${s.materialName} (-${s.missing} ${s.unit})`)
            .join(', ');
          this.activityRepo.log(
            'order_blocked',
            'order',
            id,
            `Blocked order #${id} (${record.quantity} × ${record.productName}): missing ${shortageSummary}`
          );
        }
      }
      throw err;
    }
  }

  cancelOrder(id: number): ProductionOrder {
    const cancelledRecord = runInTransaction(this.db, () => {
      const record = this.orderRepo.findById(id);
      if (!record) {
        throw new NotFoundError(`Production order #${id} not found`);
      }
      if (record.status !== 'open') {
        throw new ConflictError(
          `Order #${id} cannot be cancelled because its status is "${record.status}"`
        );
      }

      const updated = this.orderRepo.markCancelled(id)!;
      this.activityRepo.log(
        'order_cancelled',
        'order',
        id,
        `Cancelled order #${id}: ${record.quantity} × ${record.productName}`
      );
      return updated;
    });

    const product = this.productRepo.findById(cancelledRecord.productId)!;
    return this.enrichOrder(cancelledRecord, product, this.buildMaterialSnapshotMap());
  }
}
