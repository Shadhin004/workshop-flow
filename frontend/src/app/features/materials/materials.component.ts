import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Material } from '../../core/models/workshop.models';
import { ApiService, parseApiError } from '../../core/services/api.service';
import { NavBadgeService } from '../../core/services/nav-badge.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './materials.component.html',
  styleUrl: './materials.component.css',
})
export class MaterialsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly badges = inject(NavBadgeService);

  readonly materials = signal<Material[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly searchTerm = signal('');
  readonly lowStockOnly = signal(false);

  readonly modalOpen = signal(false);
  readonly editingMaterial = signal<Material | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly filteredMaterials = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const onlyLow = this.lowStockOnly();
    return this.materials().filter((m) => {
      if (onlyLow && !m.isLowStock) return false;
      if (query && !m.name.toLowerCase().includes(query) && !m.unit.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  });

  readonly lowStockCount = computed(
    () => this.materials().filter((m) => m.isLowStock).length
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    unit: ['pcs', [Validators.required, Validators.maxLength(30)]],
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
    reorderLevel: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loadMaterials();
  }

  loadMaterials(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMaterials().subscribe({
      next: (list) => {
        this.materials.set(list);
        this.badges.refresh();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(parseApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingMaterial.set(null);
    this.formError.set(null);
    this.form.reset({
      name: '',
      unit: 'pcs',
      stockQuantity: 0,
      reorderLevel: 5,
    });
    this.modalOpen.set(true);
  }

  openEditModal(material: Material): void {
    this.editingMaterial.set(material);
    this.formError.set(null);
    this.form.reset({
      name: material.name,
      unit: material.unit,
      stockQuantity: material.stockQuantity,
      reorderLevel: material.reorderLevel,
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingMaterial.set(null);
    this.formError.set(null);
  }

  saveMaterial(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    const value = this.form.getRawValue();
    const editing = this.editingMaterial();

    const req$ = editing
      ? this.api.updateMaterial(editing.id, value)
      : this.api.createMaterial(value);

    req$.subscribe({
      next: (saved) => {
        this.toast.success(
          editing ? 'Material updated' : 'Material created',
          `${saved.name} (${saved.stockQuantity} ${saved.unit})`
        );
        this.submitting.set(false);
        this.closeModal();
        this.loadMaterials();
      },
      error: (err) => {
        this.formError.set(parseApiError(err).message);
        this.submitting.set(false);
      },
    });
  }

  deleteMaterial(material: Material): void {
    if (!confirm(`Delete "${material.name}" from inventory?`)) {
      return;
    }

    this.api.deleteMaterial(material.id).subscribe({
      next: () => {
        this.toast.success('Material deleted', `${material.name} removed.`);
        this.loadMaterials();
      },
      error: (err) => {
        this.toast.error('Cannot delete material', parseApiError(err).message);
      },
    });
  }
}
