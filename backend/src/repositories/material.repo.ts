import type { SqliteDb } from '../db/database.js';
import { isLowStock, roundQuantity } from '../domain/stock.js';
import type {
  CreateMaterialInput,
  Material,
  UpdateMaterialInput,
} from '../domain/types.js';

interface MaterialRow {
  id: number;
  name: string;
  unit: string;
  stock_quantity: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

function mapMaterial(row: MaterialRow): Material {
  const stockQuantity = roundQuantity(Number(row.stock_quantity));
  const reorderLevel = roundQuantity(Number(row.reorder_level));
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    stockQuantity,
    reorderLevel,
    isLowStock: isLowStock(stockQuantity, reorderLevel),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MaterialRepository {
  constructor(private readonly db: SqliteDb) {}

  findAll(): Material[] {
    const rows = this.db
      .prepare('SELECT * FROM materials ORDER BY name COLLATE NOCASE ASC')
      .all() as MaterialRow[];
    return rows.map(mapMaterial);
  }

  findLowStock(): Material[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM materials WHERE stock_quantity <= reorder_level ORDER BY (reorder_level - stock_quantity) DESC, name COLLATE NOCASE ASC'
      )
      .all() as MaterialRow[];
    return rows.map(mapMaterial);
  }

  findById(id: number): Material | null {
    const row = this.db
      .prepare('SELECT * FROM materials WHERE id = ?')
      .get(id) as MaterialRow | undefined;
    return row ? mapMaterial(row) : null;
  }

  findByIds(ids: number[]): Material[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT * FROM materials WHERE id IN (${placeholders})`)
      .all(...ids) as MaterialRow[];
    return rows.map(mapMaterial);
  }

  findByName(name: string): Material | null {
    const row = this.db
      .prepare('SELECT * FROM materials WHERE LOWER(name) = LOWER(?)')
      .get(name.trim()) as MaterialRow | undefined;
    return row ? mapMaterial(row) : null;
  }

  create(input: CreateMaterialInput): Material {
    const result = this.db
      .prepare(
        `INSERT INTO materials (name, unit, stock_quantity, reorder_level)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        input.name.trim(),
        input.unit.trim(),
        roundQuantity(input.stockQuantity),
        roundQuantity(input.reorderLevel)
      );

    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdateMaterialInput): Material | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const nextName = input.name !== undefined ? input.name.trim() : existing.name;
    const nextUnit = input.unit !== undefined ? input.unit.trim() : existing.unit;
    const nextStock =
      input.stockQuantity !== undefined
        ? roundQuantity(input.stockQuantity)
        : existing.stockQuantity;
    const nextReorder =
      input.reorderLevel !== undefined
        ? roundQuantity(input.reorderLevel)
        : existing.reorderLevel;

    this.db
      .prepare(
        `UPDATE materials
         SET name = ?, unit = ?, stock_quantity = ?, reorder_level = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(nextName, nextUnit, nextStock, nextReorder, id);

    return this.findById(id);
  }

  updateStockQuantity(id: number, newStockQuantity: number): void {
    this.db
      .prepare(
        `UPDATE materials
         SET stock_quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(roundQuantity(newStockQuantity), id);
  }

  isUsedInAnyBom(materialId: number): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM bill_of_materials WHERE material_id = ? LIMIT 1')
      .get(materialId);
    return Boolean(row);
  }

  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM materials WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
