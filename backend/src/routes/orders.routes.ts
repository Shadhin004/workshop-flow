import { Router } from 'express';
import type { SqliteDb } from '../db/database.js';
import { parsePositiveIntId } from '../middleware/error-handler.js';
import {
  createOrderSchema,
  orderStatusQuerySchema,
} from '../middleware/validate.js';
import { OrderService } from '../services/order.service.js';

export function createOrdersRouter(db: SqliteDb): Router {
  const router = Router();
  const service = new OrderService(db);

  router.get('/', (req, res) => {
    const status = orderStatusQuerySchema.parse(req.query.status);
    res.json({ data: service.listOrders(status) });
  });

  router.get('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'order ID');
    res.json({ data: service.getOrder(id) });
  });

  router.post('/', (req, res) => {
    const payload = createOrderSchema.parse(req.body);
    const created = service.createOrder(payload);
    res.status(201).json({ data: created });
  });

  router.post('/:id/complete', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'order ID');
    const completed = service.completeOrder(id);
    res.json({ data: completed });
  });

  router.post('/:id/cancel', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'order ID');
    const cancelled = service.cancelOrder(id);
    res.json({ data: cancelled });
  });

  return router;
}
