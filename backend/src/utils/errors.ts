import type { MaterialShortage } from '../domain/types.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class InsufficientStockError extends AppError {
  public readonly shortages: MaterialShortage[];

  constructor(shortages: MaterialShortage[]) {
    const summary = shortages
      .map((s) => `${s.materialName}: missing ${s.missing} ${s.unit}`)
      .join(', ');
    super(
      409,
      'INSUFFICIENT_STOCK',
      `Insufficient stock to complete order (${summary})`,
      { shortages }
    );
    this.shortages = shortages;
  }
}
