import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<ToastMessage[]>([]);

  show(kind: ToastKind, title: string, detail?: string, durationMs = 4500): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, title, detail }]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  success(title: string, detail?: string): void {
    this.show('success', title, detail);
  }

  warning(title: string, detail?: string): void {
    this.show('warning', title, detail, 6000);
  }

  error(title: string, detail?: string): void {
    this.show('error', title, detail, 7000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
