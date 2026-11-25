import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../utils/errors.js';

export function parsePositiveIntId(raw: string, label = 'ID'): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`Invalid ${label}: "${raw}" must be a positive integer`);
  }
  return parsed;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: issues.map((i) => `${i.field}: ${i.message}`).join('; '),
        details: { issues },
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  console.error('Unhandled API error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred',
    },
  });
}
