import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Factory that returns a middleware validating req[target] against a Zod schema.
 * On success, replaces req[target] with the parsed (coerced) value.
 */
export const validate = (
  schema: ZodSchema,
  target: ValidationTarget = 'body',
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));

      return next(new AppError('Validation failed', 400, errors));
    }

    // Replace with parsed/coerced values
    (req as any)[target] = result.data;
    next();
  };
};

/**
 * Validate multiple targets at once.
 */
export const validateAll = (schemas: Partial<Record<ValidationTarget, ZodSchema>>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: Array<{ field: string; message: string; code: string }> = [];

    for (const [target, schema] of Object.entries(schemas) as [ValidationTarget, ZodSchema][]) {
      const result = schema.safeParse(req[target]);
      if (!result.success) {
        const errors = (result.error as ZodError).errors.map((e) => ({
          field: `${target}.${e.path.join('.')}`,
          message: e.message,
          code: e.code,
        }));
        allErrors.push(...errors);
      } else {
        (req as any)[target] = result.data;
      }
    }

    if (allErrors.length > 0) {
      return next(new AppError('Validation failed', 400, allErrors));
    }

    next();
  };
};