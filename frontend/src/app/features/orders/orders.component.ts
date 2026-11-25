import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  MaterialShortage,
  OrderStatus,
  Product,
  ProductionOrder,
} from '../../core/models/workshop.models';
import { ApiService, parseApiError } from '../../core/services/api.service';
import { NavBadgeService } from '../../core/services/nav-badge.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly badges = inject(NavBadgeService);

  readonly orders = signal<ProductionOrder[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly statusFilter = signal<'all' | OrderStatus>('all');
  readonly processingOrderId = signal<number | null>(null);
  readonly blockedBannerByOrder = signal<Record<number, MaterialShortage[] | undefined>>({});

  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectedProductId = signal<number | null>(null);
  readonly previewQuantity = signal<number>(1);

  readonly filteredOrders = computed(() => {
    const filter = this.statusFilter();
    if (filter === 'all') return this.orders();
    return this.orders().filter((o) => o.status === filter);
  });

  readonly liveBomPreview = computed(() => {
    const productId = this.selectedProductId();
    const qty = this.previewQuantity();
    const product = this.products().find((p) => p.id === productId);
    if (!product || !Number.isInteger(qty) || qty <= 0) {
      return [];
    }
    return product.bom.map((line) => {
      const required = Math.round(line.quantityPerUnit * qty * 1000) / 1000;
      const missing =
        line.currentStock < required
          ? Math.round((required - line.currentStock) * 1000) / 1000
          : 0;
      return {
        ...line,
        required,
        missing,
      };
    });
  });

  readonly form = this.fb.nonNullable.group({
    productId: [0, [Validators.required, Validators.min(1)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    notes: ['', [Validators.maxLength(300)]],
  });

  ngOnInit(): void {
    this.form.controls.productId.valueChanges.subscribe((val) => {
      this.selectedProductId.set(Number(val));
    });
    this.form.controls.quantity.valueChanges.subscribe((val) => {
      this.previewQuantity.set(Number(val));
    });
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getProducts().subscribe({
      next: (list) => this.products.set(list),
      error: () => {},
    });

    this.api.getOrders().subscribe({
      next: (list) => {
        this.orders.set(list);
        this.badges.refresh();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(parseApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    const firstProductId = this.products()[0]?.id ?? 0;
    this.formError.set(null);
    this.form.reset({
      productId: firstProductId,
      quantity: 1,
      notes: '',
    });
    this.selectedProductId.set(firstProductId);
    this.previewQuantity.set(1);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.formError.set(null);
  }

  createOrder(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.submitting.set(true);
    this.formError.set(null);

    this.api
      .createOrder({
        productId: Number(raw.productId),
        quantity: Number(raw.quantity),
        notes: raw.notes.trim(),
      })
      .subscribe({
        next: (created) => {
          this.toast.success(
            `Order #${created.id} created`,
            `${created.quantity} × ${created.productName}`
          );
          this.submitting.set(false);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.formError.set(parseApiError(err).message);
          this.submitting.set(false);
        },
      });
  }

  completeOrder(order: ProductionOrder): void {
    this.processingOrderId.set(order.id);
    this.api.completeOrder(order.id).subscribe({
      next: (completed) => {
        this.blockedBannerByOrder.update((prev) => {
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
        this.toast.success(
          `Order #${completed.id} completed`,
          `${completed.quantity} × ${completed.productName} — stock deducted.`
        );
        this.processingOrderId.set(null);
        this.loadData();
      },
      error: (err) => {
        const parsed = parseApiError(err);
        if (parsed.shortages && parsed.shortages.length > 0) {
          this.blockedBannerByOrder.update((prev) => ({
            ...prev,
            [order.id]: parsed.shortages!,
          }));
        }
        this.toast.error(`Order #${order.id} blocked`, parsed.message);
        this.processingOrderId.set(null);
      },
    });
  }

  cancelOrder(order: ProductionOrder): void {
    if (!confirm(`Cancel production order #${order.id} (${order.quantity} × ${order.productName})?`)) {
      return;
    }

    this.processingOrderId.set(order.id);
    this.api.cancelOrder(order.id).subscribe({
      next: () => {
        this.toast.warning(`Order #${order.id} cancelled`);
        this.processingOrderId.set(null);
        this.loadData();
      },
      error: (err) => {
        this.toast.error('Failed to cancel order', parseApiError(err).message);
        this.processingOrderId.set(null);
      },
    });
  }
}
