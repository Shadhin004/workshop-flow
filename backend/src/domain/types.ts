export interface Material {
  id: number;
  name: string;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialInput {
  name: string;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
}

export interface UpdateMaterialInput {
  name?: string;
  unit?: string;
  stockQuantity?: number;
  reorderLevel?: number;
}

export interface BomLine {
  id?: number;
  materialId: number;
  materialName: string;
  unit: string;
  quantityPerUnit: number;
  currentStock: number;
}

export interface BomLineInput {
  materialId: number;
  quantityPerUnit: number;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  description: string;
  bom: BomLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  sku?: string | null;
  description?: string;
  bom: BomLineInput[];
}

export interface UpdateProductInput {
  name?: string;
  sku?: string | null;
  description?: string;
  bom?: BomLineInput[];
}

export type OrderStatus = 'open' | 'completed' | 'cancelled';

export interface MaterialShortage {
  materialId: number;
  materialName: string;
  unit: string;
  required: number;
  available: number;
  missing: number;
}

export interface OrderRequirement extends MaterialShortage {
  isShort: boolean;
}

export interface ProductionOrder {
  id: number;
  productId: number;
  productName: string;
  productSku: string | null;
  quantity: number;
  status: OrderStatus;
  notes: string;
  createdAt: string;
  completedAt: string | null;
  requirements: OrderRequirement[];
  canComplete: boolean;
  shortages: MaterialShortage[];
}

export interface CreateOrderInput {
  productId: number;
  quantity: number;
  notes?: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  entityType: 'material' | 'product' | 'order';
  entityId: number | null;
  summary: string;
  createdAt: string;
}

export interface DashboardSummary {
  stats: {
    totalMaterials: number;
    lowStockCount: number;
    totalProducts: number;
    openOrdersCount: number;
    completedOrdersCount: number;
    blockedOrdersCount: number;
  };
  lowStockMaterials: Material[];
  openOrders: ProductionOrder[];
  recentActivity: ActivityLog[];
}
