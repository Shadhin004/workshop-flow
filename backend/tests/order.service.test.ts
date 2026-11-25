import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type SqliteDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';
import { ActivityRepository } from '../src/repositories/activity.repo.js';
import { MaterialService } from '../src/services/material.service.js';
import { OrderService } from '../src/services/order.service.js';
import { ConflictError, InsufficientStockError } from '../src/utils/errors.js';

describe('OrderService & MaterialService integration (in-memory SQLite)', () => {
  let db: SqliteDb;
  let orderService: OrderService;
  let materialService: MaterialService;
  let activityRepo: ActivityRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    seedDatabase(db);
    orderService = new OrderService(db);
    materialService = new MaterialService(db);
    activityRepo = new ActivityRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('completes an open order when stock is sufficient and deducts all BOM materials', () => {
    const openOrders = orderService.listOrders('open');
    const oakTableOrder = openOrders.find((o) => o.productName === 'Oak Dining Table');
    expect(oakTableOrder).toBeDefined();
    expect(oakTableOrder!.canComplete).toBe(true);

    const beforeOak = materialService
      .listMaterials()
      .find((m) => m.name === 'Oak Wood Board')!;
    const beforeVarnish = materialService
      .listMaterials()
      .find((m) => m.name === 'Clear Satin Varnish')!;

    const completed = orderService.completeOrder(oakTableOrder!.id);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();

    const afterOak = materialService
      .listMaterials()
      .find((m) => m.name === 'Oak Wood Board')!;
    const afterVarnish = materialService
      .listMaterials()
      .find((m) => m.name === 'Clear Satin Varnish')!;

    // 2 tables * 4 boards = 8 boards; 2 tables * 0.75 L = 1.5 L
    expect(afterOak.stockQuantity).toBe(beforeOak.stockQuantity - 8);
    expect(afterVarnish.stockQuantity).toBe(beforeVarnish.stockQuantity - 1.5);
  });

  it('blocks order completion when stock is insufficient, preserves stock, and logs activity', () => {
    const openOrders = orderService.listOrders('open');
    const bookshelfOrder = openOrders.find((o) => o.productName === 'Pine Bookshelf');
    expect(bookshelfOrder).toBeDefined();
    expect(bookshelfOrder!.canComplete).toBe(false);
    expect(bookshelfOrder!.shortages).toEqual([
      expect.objectContaining({
        materialName: 'Pine Wood Board',
        required: 15,
        available: 8,
        missing: 7,
      }),
    ]);

    const pineBefore = materialService
      .listMaterials()
      .find((m) => m.name === 'Pine Wood Board')!;
    const screwsBefore = materialService
      .listMaterials()
      .find((m) => m.name === 'Wood Screws (40mm)')!;

    expect(() => orderService.completeOrder(bookshelfOrder!.id)).toThrow(
      InsufficientStockError
    );

    // Stock remains completely unchanged (atomic rollback)
    const pineAfter = materialService
      .listMaterials()
      .find((m) => m.name === 'Pine Wood Board')!;
    const screwsAfter = materialService
      .listMaterials()
      .find((m) => m.name === 'Wood Screws (40mm)')!;

    expect(pineAfter.stockQuantity).toBe(pineBefore.stockQuantity);
    expect(screwsAfter.stockQuantity).toBe(screwsBefore.stockQuantity);

    // Order stays open
    const persisted = orderService.getOrder(bookshelfOrder!.id);
    expect(persisted.status).toBe('open');

    // Blocked attempt is recorded in activity feed
    const recent = activityRepo.findRecent(5);
    expect(recent[0].action).toBe('order_blocked');
  });

  it('prevents completing an already completed order', () => {
    const completedOrders = orderService.listOrders('completed');
    expect(completedOrders.length).toBeGreaterThan(0);

    expect(() => orderService.completeOrder(completedOrders[0].id)).toThrow(
      ConflictError
    );
  });

  it('blocks deleting a material used in a BOM, but allows deleting unused materials', () => {
    const oak = materialService
      .listMaterials()
      .find((m) => m.name === 'Oak Wood Board')!;
    expect(() => materialService.deleteMaterial(oak.id)).toThrow(ConflictError);

    const extra = materialService.createMaterial({
      name: 'Sandpaper Pack',
      unit: 'packs',
      stockQuantity: 10,
      reorderLevel: 3,
    });
    expect(() => materialService.deleteMaterial(extra.id)).not.toThrow();
  });
});
