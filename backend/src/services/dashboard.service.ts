import type { SqliteDb } from '../db/database.js';
import type { DashboardSummary } from '../domain/types.js';
import { ActivityRepository } from '../repositories/activity.repo.js';
import { MaterialRepository } from '../repositories/material.repo.js';
import { ProductRepository } from '../repositories/product.repo.js';
import { OrderService } from './order.service.js';

export class DashboardService {
  private readonly materialRepo: MaterialRepository;
  private readonly productRepo: ProductRepository;
  private readonly activityRepo: ActivityRepository;
  private readonly orderService: OrderService;

  constructor(db: SqliteDb) {
    this.materialRepo = new MaterialRepository(db);
    this.productRepo = new ProductRepository(db);
    this.activityRepo = new ActivityRepository(db);
    this.orderService = new OrderService(db);
  }

  getSummary(): DashboardSummary {
    const materials = this.materialRepo.findAll();
    const lowStockMaterials = materials.filter((m) => m.isLowStock);
    const products = this.productRepo.findAll();
    const allOrders = this.orderService.listOrders();
    const openOrders = allOrders.filter((o) => o.status === 'open');
    const completedOrdersCount = allOrders.filter((o) => o.status === 'completed').length;
    const blockedOrdersCount = openOrders.filter((o) => !o.canComplete).length;
    const recentActivity = this.activityRepo.findRecent(10);

    return {
      stats: {
        totalMaterials: materials.length,
        lowStockCount: lowStockMaterials.length,
        totalProducts: products.length,
        openOrdersCount: openOrders.length,
        completedOrdersCount,
        blockedOrdersCount,
      },
      lowStockMaterials,
      openOrders,
      recentActivity,
    };
  }
}
