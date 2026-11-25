import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DashboardSummary, Material, ProductionOrder } from '../../core/models/workshop.models';
import { ApiService, parseApiError } from '../../core/services/api.service';
import { NavBadgeService } from '../../core/services/nav-badge.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly badges = inject(NavBadgeService);

  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly completingOrderId = signal<number | null>(null);
  readonly restockingMaterialId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getDashboard().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.badges.lowStockCount.set(data.stats.lowStockCount);
        this.badges.openOrdersCount.set(data.stats.openOrdersCount);
        this.badges.blockedOrdersCount.set(data.stats.blockedOrdersCount);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(parseApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  completeOrder(order: ProductionOrder): void {
    this.completingOrderId.set(order.id);
    this.api.completeOrder(order.id).subscribe({
      next: () => {
        this.toast.success(
          `Order #${order.id} completed`,
          `${order.quantity} × ${order.productName} built and materials deducted.`
        );
        this.completingOrderId.set(null);
        this.loadDashboard();
      },
      error: (err) => {
        const parsed = parseApiError(err);
        this.toast.error(`Order #${order.id} blocked`, parsed.message);
        this.completingOrderId.set(null);
        this.loadDashboard();
      },
    });
  }

  quickRestock(material: Material): void {
    const restockAmount = Math.max(material.reorderLevel * 2, 10);
    const nextStock = Math.round((material.stockQuantity + restockAmount) * 1000) / 1000;
    this.restockingMaterialId.set(material.id);

    this.api.updateMaterial(material.id, { stockQuantity: nextStock }).subscribe({
      next: (updated) => {
        this.toast.success(
          `Restocked ${updated.name}`,
          `Added ${restockAmount} ${updated.unit} (now ${updated.stockQuantity} ${updated.unit}).`
        );
        this.restockingMaterialId.set(null);
        this.loadDashboard();
      },
      error: (err) => {
        this.toast.error('Restock failed', parseApiError(err).message);
        this.restockingMaterialId.set(null);
      },
    });
  }
}
