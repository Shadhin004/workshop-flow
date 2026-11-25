import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { Material, Product } from '../../core/models/workshop.models';
import { ApiService, parseApiError } from '../../core/services/api.service';
import { NavBadgeService } from '../../core/services/nav-badge.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ProductsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly badges = inject(NavBadgeService);

  readonly products = signal<Product[]>([]);
  readonly materials = signal<Material[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly modalOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    sku: ['', [Validators.maxLength(40)]],
    description: ['', [Validators.maxLength(500)]],
    bom: this.fb.array<FormGroup>([]),
  });

  get bomArray(): FormArray<FormGroup> {
    return this.form.controls.bom;
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getMaterials().subscribe({
      next: (mats) => this.materials.set(mats),
      error: () => {},
    });

    this.api.getProducts().subscribe({
      next: (list) => {
        this.products.set(list);
        this.badges.refresh();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(parseApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  private createBomGroup(materialId?: number, quantityPerUnit = 1): FormGroup {
    const defaultMaterialId = materialId ?? this.materials()[0]?.id ?? '';
    return this.fb.group({
      materialId: [defaultMaterialId, [Validators.required]],
      quantityPerUnit: [quantityPerUnit, [Validators.required, Validators.min(0.001)]],
    });
  }

  addBomLine(): void {
    const usedIds = new Set(
      this.bomArray.controls.map((g) => Number(g.get('materialId')?.value))
    );
    const nextAvailable = this.materials().find((m) => !usedIds.has(m.id));
    this.bomArray.push(this.createBomGroup(nextAvailable?.id));
  }

  removeBomLine(index: number): void {
    if (this.bomArray.length > 1) {
      this.bomArray.removeAt(index);
    }
  }

  unitForMaterial(materialIdValue: unknown): string {
    const id = Number(materialIdValue);
    return this.materials().find((m) => m.id === id)?.unit ?? '';
  }

  openCreateModal(): void {
    this.editingProduct.set(null);
    this.formError.set(null);
    this.form.reset({ name: '', sku: '', description: '' });
    this.bomArray.clear();
    this.bomArray.push(this.createBomGroup());
    this.modalOpen.set(true);
  }

  openEditModal(product: Product): void {
    this.editingProduct.set(product);
    this.formError.set(null);
    this.form.reset({
      name: product.name,
      sku: product.sku ?? '',
      description: product.description,
    });
    this.bomArray.clear();
    for (const line of product.bom) {
      this.bomArray.push(this.createBomGroup(line.materialId, line.quantityPerUnit));
    }
    if (this.bomArray.length === 0) {
      this.bomArray.push(this.createBomGroup());
    }
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingProduct.set(null);
    this.formError.set(null);
  }

  saveProduct(): void {
    if (this.form.invalid || this.bomArray.length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const bom = raw.bom.map((line) => ({
      materialId: Number(line['materialId']),
      quantityPerUnit: Number(line['quantityPerUnit']),
    }));

    const seen = new Set<number>();
    for (const item of bom) {
      if (seen.has(item.materialId)) {
        this.formError.set('Each material can only appear once in the bill of materials.');
        return;
      }
      seen.add(item.materialId);
    }

    const payload = {
      name: raw.name.trim(),
      sku: raw.sku.trim() ? raw.sku.trim() : null,
      description: raw.description.trim(),
      bom,
    };

    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editingProduct();

    const req$ = editing
      ? this.api.updateProduct(editing.id, payload)
      : this.api.createProduct(payload);

    req$.subscribe({
      next: (saved) => {
        this.toast.success(
          editing ? 'Product updated' : 'Product created',
          `${saved.name} (${saved.bom.length} BOM materials)`
        );
        this.submitting.set(false);
        this.closeModal();
        this.loadData();
      },
      error: (err) => {
        this.formError.set(parseApiError(err).message);
        this.submitting.set(false);
      },
    });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Delete product "${product.name}"?`)) {
      return;
    }

    this.api.deleteProduct(product.id).subscribe({
      next: () => {
        this.toast.success('Product deleted', `${product.name} removed.`);
        this.loadData();
      },
      error: (err) => {
        this.toast.error('Cannot delete product', parseApiError(err).message);
      },
    });
  }
}
