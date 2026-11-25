import { Router } from 'express';
import type { SqliteDb } from '../db/database.js';
import { parsePositiveIntId } from '../middleware/error-handler.js';
import {
  createProductSchema,
  updateProductSchema,
} from '../middleware/validate.js';
import { ProductService } from '../services/product.service.js';

export function createProductsRouter(db: SqliteDb): Router {
  const router = Router();
  const service = new ProductService(db);

  router.get('/', (_req, res) => {
    res.json({ data: service.listProducts() });
  });

  router.get('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'product ID');
    res.json({ data: service.getProduct(id) });
  });

  router.post('/', (req, res) => {
    const payload = createProductSchema.parse(req.body);
    const created = service.createProduct(payload);
    res.status(201).json({ data: created });
  });

  router.put('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'product ID');
    const payload = updateProductSchema.parse(req.body);
    const updated = service.updateProduct(id, payload);
    res.json({ data: updated });
  });

  router.delete('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'product ID');
    service.deleteProduct(id);
    res.status(204).send();
  });

  return router;
}
