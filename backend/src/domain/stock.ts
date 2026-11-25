import type { MaterialShortage, OrderRequirement } from './types.js';

export interface BomRequirementInput {
  materialId: number;
  quantityPerUnit: number;
}

export interface MaterialStockSnapshot {
  id: number;
  name: string;
  unit: string;
  stockQuantity: number;
}

export interface CalculatedRequirement {
  materialId: number;
  requiredQuantity: number;
}

export interface StockEvaluation {
  canComplete: boolean;
  requirements: OrderRequirement[];
  shortages: MaterialShortage[];
}

/**
 * Rounds quantities to 3 decimal places to avoid IEEE 754 floating-point drift
 * when working with fractional units such as liters of varnish or meters of timber.
 */
export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function isLowStock(stockQuantity: number, reorderLevel: number): boolean {
  return roundQuantity(stockQuantity) <= roundQuantity(reorderLevel);
}

export function calculateRequiredMaterials(
  bom: BomRequirementInput[],
  orderQuantity: number
): CalculatedRequirement[] {
  if (!Number.isInteger(orderQuantity) || orderQuantity <= 0) {
    throw new Error('Order quantity must be a positive integer');
  }

  // Merge duplicate material lines defensively if any occur
  const totals = new Map<number, number>();
  for (const item of bom) {
    if (item.quantityPerUnit <= 0 || !Number.isFinite(item.quantityPerUnit)) {
      throw new Error(`Invalid BOM quantity for material ${item.materialId}`);
    }
    const existing = totals.get(item.materialId) ?? 0;
    totals.set(
      item.materialId,
      roundQuantity(existing + item.quantityPerUnit * orderQuantity)
    );
  }

  return Array.from(totals.entries()).map(([materialId, requiredQuantity]) => ({
    materialId,
    requiredQuantity,
  }));
}

export function evaluateStockAvailability(
  bom: BomRequirementInput[],
  orderQuantity: number,
  materialsById: Map<number, MaterialStockSnapshot>
): StockEvaluation {
  const calculated = calculateRequiredMaterials(bom, orderQuantity);
  const requirements: OrderRequirement[] = [];
  const shortages: MaterialShortage[] = [];

  for (const req of calculated) {
    const material = materialsById.get(req.materialId);
    if (!material) {
      throw new Error(`Material ${req.materialId} not found in stock snapshot`);
    }

    const available = roundQuantity(material.stockQuantity);
    const required = roundQuantity(req.requiredQuantity);
    const missing = available < required ? roundQuantity(required - available) : 0;
    const isShort = missing > 0;

    const entry: OrderRequirement = {
      materialId: material.id,
      materialName: material.name,
      unit: material.unit,
      required,
      available,
      missing,
      isShort,
    };

    requirements.push(entry);
    if (isShort) {
      shortages.push({
        materialId: entry.materialId,
        materialName: entry.materialName,
        unit: entry.unit,
        required: entry.required,
        available: entry.available,
        missing: entry.missing,
      });
    }
  }

  return {
    canComplete: shortages.length === 0,
    requirements,
    shortages,
  };
}

export function computeDeductedStocks(
  requirements: OrderRequirement[]
): Array<{ materialId: number; newStockQuantity: number }> {
  return requirements.map((req) => {
    const remaining = roundQuantity(req.available - req.required);
    if (remaining < 0) {
      throw new Error(
        `Cannot deduct ${req.required} ${req.unit} of ${req.materialName} from ${req.available}`
      );
    }
    return {
      materialId: req.materialId,
      newStockQuantity: remaining,
    };
  });
}
