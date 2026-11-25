import { runInTransaction, type SqliteDb } from './database.js';

export function seedDatabase(db: SqliteDb): boolean {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM materials').get() as {
    count: number;
  };
  if (existing.count > 0) {
    return false;
  }

  runInTransaction(db, () => {
    const insertMaterial = db.prepare(
      `INSERT INTO materials (name, unit, stock_quantity, reorder_level)
       VALUES (?, ?, ?, ?)`
    );

    const oakBoardId = Number(
      insertMaterial.run('Oak Wood Board', 'boards', 24, 10).lastInsertRowid
    );
    const pineBoardId = Number(
      insertMaterial.run('Pine Wood Board', 'boards', 8, 12).lastInsertRowid
    );
    const screwsId = Number(
      insertMaterial.run('Wood Screws (40mm)', 'pcs', 320, 150).lastInsertRowid
    );
    const bracketsId = Number(
      insertMaterial.run('Shelf Brackets', 'pcs', 14, 20).lastInsertRowid
    );
    const paintId = Number(
      insertMaterial.run('Matte White Paint', 'L', 6.5, 4).lastInsertRowid
    );
    const varnishId = Number(
      insertMaterial.run('Clear Satin Varnish', 'L', 2.5, 3).lastInsertRowid
    );
    const glueId = Number(
      insertMaterial.run('Wood Glue', 'L', 5, 2).lastInsertRowid
    );

    const insertProduct = db.prepare(
      `INSERT INTO products (name, sku, description)
       VALUES (?, ?, ?)`
    );
    const insertBom = db.prepare(
      `INSERT INTO bill_of_materials (product_id, material_id, quantity_per_unit)
       VALUES (?, ?, ?)`
    );

    const diningTableId = Number(
      insertProduct.run(
        'Oak Dining Table',
        'TBL-OAK-01',
        'Solid oak 6-seater dining table with satin varnish finish'
      ).lastInsertRowid
    );
    insertBom.run(diningTableId, oakBoardId, 4);
    insertBom.run(diningTableId, screwsId, 24);
    insertBom.run(diningTableId, varnishId, 0.75);
    insertBom.run(diningTableId, glueId, 0.25);

    const bookshelfId = Number(
      insertProduct.run(
        'Pine Bookshelf',
        'SHF-PIN-01',
        '5-tier freestanding pine bookshelf painted matte white'
      ).lastInsertRowid
    );
    insertBom.run(bookshelfId, pineBoardId, 5);
    insertBom.run(bookshelfId, screwsId, 20);
    insertBom.run(bookshelfId, bracketsId, 4);
    insertBom.run(bookshelfId, paintId, 0.8);

    const diningChairId = Number(
      insertProduct.run(
        'Workshop Dining Chair',
        'CHR-OAK-01',
        'Hand-joined oak chair matching the Oak Dining Table'
      ).lastInsertRowid
    );
    insertBom.run(diningChairId, oakBoardId, 2);
    insertBom.run(diningChairId, screwsId, 12);
    insertBom.run(diningChairId, varnishId, 0.35);
    insertBom.run(diningChairId, glueId, 0.1);

    const wallShelfId = Number(
      insertProduct.run(
        'Wall Floating Shelf',
        'SHF-WAL-02',
        'Compact pine wall shelf with concealed metal brackets'
      ).lastInsertRowid
    );
    insertBom.run(wallShelfId, pineBoardId, 1);
    insertBom.run(wallShelfId, screwsId, 6);
    insertBom.run(wallShelfId, bracketsId, 2);
    insertBom.run(wallShelfId, paintId, 0.25);

    const completedOrderId = Number(
      db
        .prepare(
          `INSERT INTO production_orders (product_id, quantity, status, notes, completed_at)
           VALUES (?, ?, 'completed', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'))`
        )
        .run(diningChairId, 4, 'Completed batch for showroom display')
        .lastInsertRowid
    );

    const openReadyOrderId = Number(
      db
        .prepare(
          `INSERT INTO production_orders (product_id, quantity, status, notes)
           VALUES (?, ?, 'open', ?)`
        )
        .run(diningTableId, 2, 'Customer order #1042 - Oak finish')
        .lastInsertRowid
    );

    const openBlockedOrderId = Number(
      db
        .prepare(
          `INSERT INTO production_orders (product_id, quantity, status, notes)
           VALUES (?, ?, 'open', ?)`
        )
        .run(bookshelfId, 3, 'Awaiting pine board restock before assembly')
        .lastInsertRowid
    );

    const insertActivity = db.prepare(
      `INSERT INTO activity_logs (action, entity_type, entity_id, summary)
       VALUES (?, ?, ?, ?)`
    );
    insertActivity.run(
      'material_seeded',
      'material',
      null,
      'Initialized furniture workshop inventory with 7 raw materials'
    );
    insertActivity.run(
      'product_created',
      'product',
      diningTableId,
      'Added product catalog: Oak Dining Table, Pine Bookshelf, Workshop Dining Chair, Wall Floating Shelf'
    );
    insertActivity.run(
      'order_completed',
      'order',
      completedOrderId,
      `Completed order #${completedOrderId}: 4 × Workshop Dining Chair`
    );
    insertActivity.run(
      'order_created',
      'order',
      openReadyOrderId,
      `Created order #${openReadyOrderId}: 2 × Oak Dining Table`
    );
    insertActivity.run(
      'order_created',
      'order',
      openBlockedOrderId,
      `Created order #${openBlockedOrderId}: 3 × Pine Bookshelf`
    );
  });

  return true;
}
