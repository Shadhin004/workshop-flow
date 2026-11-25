import { describe, expect, it } from 'vitest';
import {
  calculateRequiredMaterials,
  computeDeductedStocks,
  evaluateStockAvailability,
  isLowStock,
  roundQuantity,
  type MaterialStockSnapshot,
} from '../src/domain/stock.js';

describe('stock domain logic', () => {
  describe('roundQuantity', () => {
    it('eliminates IEEE 754 floating-point drift up to 3 decimals', () => {
      expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
      expect(roundQuantity(2.5 - 0.75 * 3)).toBe(0.25);
    });
  });

  describe('isLowStock', () => {
    it('returns true when stock is below reorder level', () => {
      expect(isLowStock(8, 12)).toBe(true);
    });

    it('returns true when stock is exactly at reorder level', () => {
      expect(isLowStock(10, 10)).toBe(true);
    });

    it('returns false when stock is above reorder level', () => {
      expect(isLowStock(10.001, 10)).toBe(false);
    });
  });

  describe('calculateRequiredMaterials', () => {
    it('multiplies BOM quantities by order quantity', () => {
      const result = calculateRequiredMaterials(
        [
          { materialId: 1, quantityPerUnit: 4 },
          { materialId: 2, quantityPerUnit: 0.75 },
        ],
        3
      );

      expect(result).toEqual([
        { materialId: 1, requiredQuantity: 12 },
        { materialId: 2, requiredQuantity: 2.25 },
      ]);
    });

    it('merges duplicate BOM lines defensively', () => {
      const result = calculateRequiredMaterials(
        [
          { materialId: 1, quantityPerUnit: 1.5 },
          { materialId: 1, quantityPerUnit: 0.5 },
        ],
        4
      );

      expect(result).toEqual([{ materialId: 1, requiredQuantity: 8 }]);
    });

    it('throws for non-positive or fractional order quantities', () => {
      expect(() => calculateRequiredMaterials([], 0)).toThrow();
      expect(() => calculateRequiredMaterials([], -2)).toThrow();
      expect(() => calculateRequiredMaterials([], 1.5)).toThrow();
    });
  });

  describe('evaluateStockAvailability', () => {
    const snapshot = new Map<number, MaterialStockSnapshot>([
      [1, { id: 1, name: 'Oak Wood Board', unit: 'boards', stockQuantity: 10 }],
      [2, { id: 2, name: 'Wood Screws', unit: 'pcs', stockQuantity: 50 }],
      [3, { id: 3, name: 'Clear Varnish', unit: 'L', stockQuantity: 2.5 }],
    ]);

    it('allows completion when all materials meet or exactly match required amounts', () => {
      const evaluation = evaluateStockAvailability(
        [
          { materialId: 1, quantityPerUnit: 5 },
          { materialId: 2, quantityPerUnit: 20 },
          { materialId: 3, quantityPerUnit: 1.25 },
        ],
        2,
        snapshot
      );

      expect(evaluation.canComplete).toBe(true);
      expect(evaluation.shortages).toEqual([]);
      expect(evaluation.requirements).toEqual([
        {
          materialId: 1,
          materialName: 'Oak Wood Board',
          unit: 'boards',
          required: 10,
          available: 10,
          missing: 0,
          isShort: false,
        },
        {
          materialId: 2,
          materialName: 'Wood Screws',
          unit: 'pcs',
          required: 40,
          available: 50,
          missing: 0,
          isShort: false,
        },
        {
          materialId: 3,
          materialName: 'Clear Varnish',
          unit: 'L',
          required: 2.5,
          available: 2.5,
          missing: 0,
          isShort: false,
        },
      ]);
    });

    it('blocks completion and identifies exact missing materials and quantities', () => {
      const evaluation = evaluateStockAvailability(
        [
          { materialId: 1, quantityPerUnit: 4 }, // needs 12, has 10 -> missing 2
          { materialId: 2, quantityPerUnit: 10 }, // needs 30, has 50 -> ok
          { materialId: 3, quantityPerUnit: 1.05 }, // needs 3.15, has 2.5 -> missing 0.65
        ],
        3,
        snapshot
      );

      expect(evaluation.canComplete).toBe(false);
      expect(evaluation.shortages).toEqual([
        {
          materialId: 1,
          materialName: 'Oak Wood Board',
          unit: 'boards',
          required: 12,
          available: 10,
          missing: 2,
        },
        {
          materialId: 3,
          materialName: 'Clear Varnish',
          unit: 'L',
          required: 3.15,
          available: 2.5,
          missing: 0.65,
        },
      ]);
    });
  });

  describe('computeDeductedStocks', () => {
    it('subtracts required quantities accurately', () => {
      const updated = computeDeductedStocks([
        {
          materialId: 1,
          materialName: 'Oak Wood Board',
          unit: 'boards',
          required: 8,
          available: 24,
          missing: 0,
          isShort: false,
        },
        {
          materialId: 3,
          materialName: 'Clear Varnish',
          unit: 'L',
          required: 1.5,
          available: 2.5,
          missing: 0,
          isShort: false,
        },
      ]);

      expect(updated).toEqual([
        { materialId: 1, newStockQuantity: 16 },
        { materialId: 3, newStockQuantity: 1 },
      ]);
    });

    it('throws if deduction would result in negative stock', () => {
      expect(() =>
        computeDeductedStocks([
          {
            materialId: 1,
            materialName: 'Oak Wood Board',
            unit: 'boards',
            required: 12,
            available: 10,
            missing: 2,
            isShort: true,
          },
        ])
      ).toThrow();
    });
  });
});
