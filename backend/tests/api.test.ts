import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabase, type SqliteDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';

describe('REST API endpoints & status codes', () => {
  let db: SqliteDb;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    seedDatabase(db);
    const app = createApp({ db, staticDir: '/non-existent-dir' });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  });

  it('GET /api/health returns 200 ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /api/dashboard returns seeded summary', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { stats: { totalMaterials: number; lowStockCount: number } };
    };
    expect(body.data.stats.totalMaterials).toBe(7);
    expect(body.data.stats.lowStockCount).toBe(3);
  });

  it('POST /api/materials validates input (400) and creates material (201)', async () => {
    const invalidRes = await fetch(`${baseUrl}/api/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', unit: 'pcs', stockQuantity: -5, reorderLevel: 2 }),
    });
    expect(invalidRes.status).toBe(400);

    const createRes = await fetch(`${baseUrl}/api/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Brass Hinges',
        unit: 'pcs',
        stockQuantity: 40,
        reorderLevel: 10,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: number; name: string } };
    expect(created.data.name).toBe('Brass Hinges');

    const deleteRes = await fetch(`${baseUrl}/api/materials/${created.data.id}`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(204);
  });

  it('POST /api/orders/:id/complete returns 409 INSUFFICIENT_STOCK with shortages', async () => {
    const ordersRes = await fetch(`${baseUrl}/api/orders?status=open`);
    const ordersBody = (await ordersRes.json()) as {
      data: Array<{ id: number; productName: string }>;
    };
    const blocked = ordersBody.data.find((o) => o.productName === 'Pine Bookshelf')!;

    const completeRes = await fetch(`${baseUrl}/api/orders/${blocked.id}/complete`, {
      method: 'POST',
    });
    expect(completeRes.status).toBe(409);

    const errBody = (await completeRes.json()) as {
      error: { code: string; details: { shortages: Array<{ materialName: string; missing: number }> } };
    };
    expect(errBody.error.code).toBe('INSUFFICIENT_STOCK');
    expect(errBody.error.details.shortages[0]).toMatchObject({
      materialName: 'Pine Wood Board',
      missing: 7,
    });
  });

  it('returns 404 for unknown resource IDs', async () => {
    const res = await fetch(`${baseUrl}/api/materials/99999`);
    expect(res.status).toBe(404);
  });
});
