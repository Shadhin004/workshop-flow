import type { SqliteDb } from '../db/database.js';
import type { CreateOrderInput, OrderStatus } from '../domain/types.js';

export interface OrderRecord {
  id: number;
  productId: number;
  productName: string;
  productSku: string | null;
  quantity: number;
  status: OrderStatus;
  notes: string;
  createdAt: string;
  completedAt: string | null;
}

interface OrderRow {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  status: OrderStatus;
  notes: string;
  created_at: string;
  completed_at: string | null;
}

function mapOrderRow(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    quantity: row.quantity,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export class OrderRepository {
  constructor(private readonly db: SqliteDb) {}

  findAll(status?: OrderStatus): OrderRecord[] {
    const baseQuery = `
      SELECT po.id, po.product_id, p.name AS product_name, p.sku AS product_sku,
             po.quantity, po.status, po.notes, po.created_at, po.completed_at
      FROM production_orders po
      INNER JOIN products p ON p.id = po.product_id
    `;

    const rows = status
      ? (this.db
          .prepare(`${baseQuery} WHERE po.status = ? ORDER BY po.created_at DESC, po.id DESC`)
          .all(status) as OrderRow[])
      : (this.db
          .prepare(
            `${baseQuery}
             ORDER BY CASE po.status WHEN 'open' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
                      po.created_at DESC, po.id DESC`
          )
          .all() as OrderRow[]);

    return rows.map(mapOrderRow);
  }

  findById(id: number): OrderRecord | null {
    const row = this.db
      .prepare(
        `SELECT po.id, po.product_id, p.name AS product_name, p.sku AS product_sku,
                po.quantity, po.status, po.notes, po.created_at, po.completed_at
         FROM production_orders po
         INNER JOIN products p ON p.id = po.product_id
         WHERE po.id = ?`
      )
      .get(id) as OrderRow | undefined;
    return row ? mapOrderRow(row) : null;
  }

  create(input: CreateOrderInput): OrderRecord {
    const res = this.db
      .prepare(
        `INSERT INTO production_orders (product_id, quantity, status, notes)
         VALUES (?, ?, 'open', ?)`
      )
      .run(input.productId, input.quantity, (input.notes ?? '').trim());

    return this.findById(Number(res.lastInsertRowid))!;
  }

  markCompleted(id: number): OrderRecord | null {
    this.db
      .prepare(
        `UPDATE production_orders
         SET status = 'completed',
             completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND status = 'open'`
      )
      .run(id);

    return this.findById(id);
  }

  markCancelled(id: number): OrderRecord | null {
    this.db
      .prepare(
        `UPDATE production_orders
         SET status = 'cancelled'
         WHERE id = ? AND status = 'open'`
      )
      .run(id);

    return this.findById(id);
  }
}
