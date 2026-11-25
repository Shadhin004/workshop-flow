import { z } from 'zod';

export const createMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  unit: z.string().trim().min(1, 'Unit is required').max(30, 'Unit is too long'),
  stockQuantity: z.coerce
    .number()
    .finite()
    .min(0, 'Stock quantity cannot be negative'),
  reorderLevel: z.coerce
    .number()
    .finite()
    .min(0, 'Reorder level cannot be negative'),
});

export const updateMaterialSchema = createMaterialSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

const bomLineSchema = z.object({
  materialId: z.coerce.number().int().positive('Material ID must be positive'),
  quantityPerUnit: z.coerce
    .number()
    .finite()
    .positive('Quantity per unit must be greater than 0'),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(120),
  sku: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  description: z.string().trim().max(500).optional().default(''),
  bom: z.array(bomLineSchema).min(1, 'At least one material is required in the BOM'),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    sku: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    description: z.string().trim().max(500).optional(),
    bom: z.array(bomLineSchema).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createOrderSchema = z.object({
  productId: z.coerce.number().int().positive('Product ID must be positive'),
  quantity: z.coerce
    .number()
    .int('Order quantity must be a whole number')
    .positive('Order quantity must be at least 1'),
  notes: z.string().trim().max(300).optional().default(''),
});

export const orderStatusQuerySchema = z
  .enum(['open', 'completed', 'cancelled'])
  .optional();
