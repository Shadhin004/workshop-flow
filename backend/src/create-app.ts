import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import type { SqliteDb } from './db/database.js';
import { errorHandler } from './middleware/error-handler.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { createMaterialsRouter } from './routes/materials.routes.js';
import { createOrdersRouter } from './routes/orders.routes.js';
import { createProductsRouter } from './routes/products.routes.js';

export interface AppOptions {
  db: SqliteDb;
  corsOrigin?: string | boolean;
  staticDir?: string;
}

export function configureApp(app: Express, options: AppOptions): Express {
  app.use(
    cors({
      origin: options.corsOrigin ?? 'http://localhost:4200',
    })
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'workshop-flow-api' });
  });

  app.use('/api/dashboard', createDashboardRouter(options.db));
  app.use('/api/materials', createMaterialsRouter(options.db));
  app.use('/api/products', createProductsRouter(options.db));
  app.use('/api/orders', createOrdersRouter(options.db));

  // Unknown API routes return a structured 404 JSON payload
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'API endpoint not found',
      },
    });
  });

  if (options.staticDir && fs.existsSync(options.staticDir)) {
    app.use(express.static(options.staticDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(options.staticDir!, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

export function createApp(options: AppOptions): Express {
  return configureApp(express(), options);
}
