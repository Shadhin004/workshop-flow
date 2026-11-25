import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  ApiErrorBody,
  CreateMaterialPayload,
  CreateOrderPayload,
  CreateProductPayload,
  DashboardSummary,
  Material,
  MaterialShortage,
  OrderStatus,
  Product,
  ProductionOrder,
  UpdateMaterialPayload,
} from '../models/workshop.models';

interface ApiEnvelope<T> {
  data: T;
}

export interface ParsedApiError {
  message: string;
  code?: string;
  shortages?: MaterialShortage[];
}

export function parseApiError(err: unknown): ParsedApiError {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | undefined;
    if (body?.error?.message) {
      return {
        message: body.error.message,
        code: body.error.code,
        shortages: body.error.details?.shortages,
      };
    }
    if (err.status === 0) {
      return {
        message: 'Cannot reach the WorkshopFlow API server. Is the backend running?',
      };
    }
    return {
      message: err.message || `Request failed with status ${err.status}`,
    };
  }
  return {
    message: err instanceof Error ? err.message : 'An unexpected error occurred',
  };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getDashboard(): Observable<DashboardSummary> {
    return this.http
      .get<ApiEnvelope<DashboardSummary>>(`${this.baseUrl}/dashboard`)
      .pipe(map((res) => res.data));
  }

  getMaterials(): Observable<Material[]> {
    return this.http
      .get<ApiEnvelope<Material[]>>(`${this.baseUrl}/materials`)
      .pipe(map((res) => res.data));
  }

  createMaterial(payload: CreateMaterialPayload): Observable<Material> {
    return this.http
      .post<ApiEnvelope<Material>>(`${this.baseUrl}/materials`, payload)
      .pipe(map((res) => res.data));
  }

  updateMaterial(id: number, payload: UpdateMaterialPayload): Observable<Material> {
    return this.http
      .put<ApiEnvelope<Material>>(`${this.baseUrl}/materials/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  deleteMaterial(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/materials/${id}`);
  }

  getProducts(): Observable<Product[]> {
    return this.http
      .get<ApiEnvelope<Product[]>>(`${this.baseUrl}/products`)
      .pipe(map((res) => res.data));
  }

  createProduct(payload: CreateProductPayload): Observable<Product> {
    return this.http
      .post<ApiEnvelope<Product>>(`${this.baseUrl}/products`, payload)
      .pipe(map((res) => res.data));
  }

  updateProduct(id: number, payload: Partial<CreateProductPayload>): Observable<Product> {
    return this.http
      .put<ApiEnvelope<Product>>(`${this.baseUrl}/products/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/${id}`);
  }

  getOrders(status?: OrderStatus): Observable<ProductionOrder[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http
      .get<ApiEnvelope<ProductionOrder[]>>(`${this.baseUrl}/orders`, { params })
      .pipe(map((res) => res.data));
  }

  createOrder(payload: CreateOrderPayload): Observable<ProductionOrder> {
    return this.http
      .post<ApiEnvelope<ProductionOrder>>(`${this.baseUrl}/orders`, payload)
      .pipe(map((res) => res.data));
  }

  completeOrder(id: number): Observable<ProductionOrder> {
    return this.http
      .post<ApiEnvelope<ProductionOrder>>(`${this.baseUrl}/orders/${id}/complete`, {})
      .pipe(map((res) => res.data));
  }

  cancelOrder(id: number): Observable<ProductionOrder> {
    return this.http
      .post<ApiEnvelope<ProductionOrder>>(`${this.baseUrl}/orders/${id}/cancel`, {})
      .pipe(map((res) => res.data));
  }
}
