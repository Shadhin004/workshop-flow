import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class NavBadgeService {
  private readonly api = inject(ApiService);

  readonly lowStockCount = signal(0);
  readonly openOrdersCount = signal(0);
  readonly blockedOrdersCount = signal(0);

  refresh(): void {
    this.api.getDashboard().subscribe({
      next: (summary) => {
        this.lowStockCount.set(summary.stats.lowStockCount);
        this.openOrdersCount.set(summary.stats.openOrdersCount);
        this.blockedOrdersCount.set(summary.stats.blockedOrdersCount);
      },
      error: () => {
        // Silently ignore background badge refresh failures
      },
    });
  }
}
