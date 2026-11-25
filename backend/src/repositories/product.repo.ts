import { runInTransaction, type SqliteDb } from '../db/database.js';
import { roundQuantity } from '../domain/stock.js';
import type {
  BomLine,
  CreateProductInput,
  Product,
  UpdateProductInput,
} from '../domain/types.js';

interface ProductRow {
  id: number;
  name: string;
  sku: string | null;
  description: string;
  created_at: string;
  updated_at: string;
}

interface BomJoinRow {
  id: number;
  product_id: number;
  material_id: number;
  quantity_per_unit: number;
  material_name: string;
  unit: string;
  stock_quantity: number;
}

export class ProductRepository {
  constructor(private readonly db: SqliteDb) {}

  private fetchBomForProducts(productIds: number[]): Map<number, BomLine[]> {
    const map = new Map<number, BomLine[]>();
    if (productIds.length === 0) return map;

    const placeholders = productIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT bom.id, bom.product_id, bom.material_id, bom.quantity_per_unit,
                m.name AS material_name, m.unit, m.stock_quantity
         FROM bill_of_materials bom
         INNER JOIN materials m ON m.id = bom.material_id
         WHERE bom.product_id IN (${placeholders})
         ORDER BY m.name COLLATE NOCASE ASC`
      )
      .all(...productIds) as BomJoinRow[];

    for (const row of rows) {
      const list = map.get(row.product_id) ?? [];
      list.push({
        id: row.id,
        materialId: row.material_id,
        materialName: row.material_name,
        unit: row.unit,
        quantityPerUnit: roundQuantity(Number(row.quantity_per_unit)),
        currentStock: roundQuantity(Number(row.stock_quantity)),
      });
      map.set(row.product_id, list);
    }

    return map;
  }

  private mapProducts(rows: ProductRow[]): Product[] {
    const bomByProduct = this.fetchBomForProducts(rows.map((r) => r.id));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      description: row.description,
      bom: bomByProduct.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  findAll(): Product[] {
    const rows = this.db
      .prepare('SELECT * FROM products ORDER BY name COLLATE NOCASE ASC')
      .all() as ProductRow[];
    return this.mapProducts(rows);
  }

  findById(id: number): Product | null {
    const row = this.db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(id) as ProductRow | undefined;
    if (!row) return null;
    return this.mapProducts([row])[0];
  }

  findByName(name: string): Product | null {
    const row = this.db
      .prepare('SELECT * FROM products WHERE LOWER(name) = LOWER(?)')
      .get(name.trim()) as ProductRow | undefined;
    if (!row) return null;
    return this.mapProducts([row])[0];
  }

  findBySku(sku: string): Product | null {
    const row = this.db
      .prepare('SELECT * FROM products WHERE LOWER(sku) = LOWER(?)')
      .get(sku.trim()) as ProductRow | undefined;
    if (!row) return null;
    return this.mapProducts([row])[0];
  }

  create(input: CreateProductInput): Product {
    const productId = runInTransaction(this.db, () => {
      const res = this.db
        .prepare(
          `INSERT INTO products (name, sku, description)
           VALUES (?, ?, ?)`
        )
        .run(
          input.name.trim(),
          input.sku ? input.sku.trim() : null,
          (input.description ?? '').trim()
        );

      const id = Number(res.lastInsertRowid);
      const insertBom = this.db.prepare(
        `INSERT INTO bill_of_materials (product_id, material_id, quantity_per_unit)
         VALUES (?, ?, ?)`
      );
      for (const line of input.bom) {
        insertBom.run(id, line.materialId, roundQuantity(line.quantityPerUnit));
      }
      return id;
    });

    return this.findById(productId)!;
  }

  update(id: number, input: UpdateProductInput): Product | null {
    const existing = this.findById(id);
    if (!existing) return null;

    runInTransaction(this.db, () => {
      const nextName = input.name !== undefined ? input.name.trim() : existing.name;
      const nextSku =
        input.sku !== undefined
          ? input.sku
            ? input.sku.trim()
            : null
          : existing.sku;
      const nextDescription =
        input.description !== undefined
          ? input.description.trim()
          : existing.description;

      this.db
        .prepare(
          `UPDATE products
           SET name = ?, sku = ?, description = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?`
        )
        .run(nextName, nextSku, nextDescription, id);

      if (input.bom !== undefined) {
        this.db.prepare('DELETE FROM bill_of_materials WHERE product_id = ?').run(id);
        const insertBom = this.db.prepare(
          `INSERT INTO bill_of_materials (product_id, material_id, quantity_per_unit)
           VALUES (?, ?, ?)`
        );
        for (const line of input.bom) {
          insertBom.run(id, line.materialId, roundQuantity(line.quantityPerUnit));
        }
      }
    });

    return this.findById(id);
  }

  hasOrders(productId: number): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM production_orders WHERE product_id = ? LIMIT 1')
      .get(productId);
    return Boolean(row);
  }

  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
