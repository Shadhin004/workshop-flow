import type { SqliteDb } from '../db/database.js';
import { runInTransaction } from '../db/database.js';
import type {
  CreateMaterialInput,
  Material,
  UpdateMaterialInput,
} from '../domain/types.js';
import { ActivityRepository } from '../repositories/activity.repo.js';
import { MaterialRepository } from '../repositories/material.repo.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export class MaterialService {
  private readonly materialRepo: MaterialRepository;
  private readonly activityRepo: ActivityRepository;

  constructor(private readonly db: SqliteDb) {
    this.materialRepo = new MaterialRepository(db);
    this.activityRepo = new ActivityRepository(db);
  }

  listMaterials(): Material[] {
    return this.materialRepo.findAll();
  }

  getMaterial(id: number): Material {
    const material = this.materialRepo.findById(id);
    if (!material) {
      throw new NotFoundError(`Material #${id} not found`);
    }
    return material;
  }

  createMaterial(input: CreateMaterialInput): Material {
    const duplicate = this.materialRepo.findByName(input.name);
    if (duplicate) {
      throw new ConflictError(`A material named "${input.name.trim()}" already exists`);
    }

    return runInTransaction(this.db, () => {
      const created = this.materialRepo.create(input);
      this.activityRepo.log(
        'material_created',
        'material',
        created.id,
        `Added material "${created.name}" (${created.stockQuantity} ${created.unit})`
      );
      return created;
    });
  }

  updateMaterial(id: number, input: UpdateMaterialInput): Material {
    const existing = this.getMaterial(id);

    if (input.name !== undefined) {
      const duplicate = this.materialRepo.findByName(input.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`A material named "${input.name.trim()}" already exists`);
      }
    }

    return runInTransaction(this.db, () => {
      const updated = this.materialRepo.update(id, input)!;
      const stockDelta =
        input.stockQuantity !== undefined && input.stockQuantity !== existing.stockQuantity
          ? ` — stock ${existing.stockQuantity} -> ${updated.stockQuantity} ${updated.unit}`
          : '';
      this.activityRepo.log(
        'material_updated',
        'material',
        updated.id,
        `Updated material "${updated.name}"${stockDelta}`
      );
      return updated;
    });
  }

  deleteMaterial(id: number): void {
    const existing = this.getMaterial(id);

    if (this.materialRepo.isUsedInAnyBom(id)) {
      throw new ConflictError(
        `Cannot delete "${existing.name}" because it is used in a product bill of materials`
      );
    }

    runInTransaction(this.db, () => {
      this.materialRepo.delete(id);
      this.activityRepo.log(
        'material_deleted',
        'material',
        id,
        `Deleted material "${existing.name}"`
      );
    });
  }
}
