import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.kind" role="status">
          <div class="toast-content">
            <div class="toast-title">{{ toast.title }}</div>
            @if (toast.detail) {
              <div class="toast-detail">{{ toast.detail }}</div>
            }
          </div>
          <button
            type="button"
            class="toast-close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 100;
        max-width: 400px;
        width: calc(100vw - 40px);
      }

      .toast {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 10px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16);
        border: 1px solid transparent;
        background: #ffffff;
      }

      .toast-success {
        border-color: #86efac;
        background: #f0fdf4;
        color: #14532d;
      }

      .toast-warning {
        border-color: #fcd34d;
        background: #fffbeb;
        color: #78350f;
      }

      .toast-error {
        border-color: #fca5a5;
        background: #fef2f2;
        color: #7f1d1d;
      }

      .toast-title {
        font-weight: 600;
        font-size: 13.5px;
      }

      .toast-detail {
        margin-top: 2px;
        font-size: 12.5px;
        opacity: 0.9;
      }

      .toast-close {
        border: none;
        background: transparent;
        color: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        opacity: 0.7;
        padding: 0 2px;
      }

      .toast-close:hover {
        opacity: 1;
      }
    `,
  ],
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
