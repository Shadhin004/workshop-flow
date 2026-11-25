import { Router } from 'express';
import type { SqliteDb } from '../db/database.js';
import { parsePositiveIntId } from '../middleware/error-handler.js';
import {
  createMaterialSchema,
  updateMaterialSchema,
} from '../middleware/validate.js';
import { MaterialService } from '../services/material.service.js';

export function createMaterialsRouter(db: SqliteDb): Router {
  const router = Router();
  const service = new MaterialService(db);

  router.get('/', (_req, res) => {
    res.json({ data: service.listMaterials() });
  });

  router.get('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'material ID');
    res.json({ data: service.getMaterial(id) });
  });

  router.post('/', (req, res) => {
    const payload = createMaterialSchema.parse(req.body);
    const created = service.createMaterial(payload);
    res.status(201).json({ data: created });
  });

  router.put('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'material ID');
    const payload = updateMaterialSchema.parse(req.body);
    const updated = service.updateMaterial(id, payload);
    res.json({ data: updated });
  });

  router.patch('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'material ID');
    const payload = updateMaterialSchema.parse(req.body);
    const updated = service.updateMaterial(id, payload);
    res.json({ data: updated });
  });

  router.delete('/:id', (req, res) => {
    const id = parsePositiveIntId(req.params.id, 'material ID');
    service.deleteMaterial(id);
    res.status(204).send();
  });

  return router;
}
