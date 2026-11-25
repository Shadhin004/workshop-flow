import { Router } from 'express';
import type { SqliteDb } from '../db/database.js';
import { DashboardService } from '../services/dashboard.service.js';

export function createDashboardRouter(db: SqliteDb): Router {
  const router = Router();
  const service = new DashboardService(db);

  router.get('/', (_req, res) => {
    res.json({ data: service.getSummary() });
  });

  return router;
}
