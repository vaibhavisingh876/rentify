import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

interface ErrorResponse {
  success: false;
  message: string;
  errors?: unknown[];
  stack?: string;
}

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (error.code) {
    case 'P2002': {
      const fields = (error.meta?.target as string[]) || [];
      return new AppError(
        `${fields.length ? fields.join(', ') + ' is' : 'A field is'} already taken`,
        409,
      );
    }
    case 'P2025':
      return new AppError('Record not found', 404);
    case 'P2003':
      return new AppError('Related record not found', 400);
    case 'P2014':
      return new AppError('The relation constraint would be violated', 400);
    case 'P2016':
      return new AppError('Query interpretation error', 400);
    case 'P2021':
      return new AppError('Table does not exist in the database', 500);
    case 'P2022':
      return new AppError('Column does not exist in the database', 500);
    default:
      return new AppError(`Database error: ${error.code}`, 500);
  }
};

const handleZodError = (error: ZodError): AppError => {
  const errors = error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
  return new AppError('Validation failed', 400, errors);
};

const handleJWTError = (): AppError =>
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = (): AppError =>
  new AppError('Token expired. Please log in again.', 401);

const handleMulterError = (error: any): AppError => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size allowed is 10MB.', 400);
  }
  if (error.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files. Maximum 10 files allowed.', 400);
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(`Unexpected field: ${error.field}`, 400);
  }
  return new AppError(error.message || 'File upload error', 400);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let error: AppError;

  // ─── Known error types ────────────────────────────────────────────────────
  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    error = new AppError('Invalid database query', 400);
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    error = new AppError('Database connection error', 503);
  } else if (err instanceof ZodError) {
    error = handleZodError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (err.name === 'MulterError') {
    error = handleMulterError(err);
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    error = new AppError('Invalid JSON in request body', 400);
  } else {
    // Unknown / unexpected error
    error = new AppError(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      500,
    );
  }

  // ─── Logging ──────────────────────────────────────────────────────────────
  if (error.statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} – ${error.message}`, {
      statusCode: error.statusCode,
      stack: err.stack,
      body: req.body,
      params: req.params,
      query: req.query,
      userId: req.user?.id,
    });
  } else {
    logger.warn(`[${req.method}] ${req.path} – ${error.message}`, {
      statusCode: error.statusCode,
      userId: req.user?.id,
    });
  }

  // ─── Response ─────────────────────────────────────────────────────────────
  const response: ErrorResponse = {
    success: false,
    message: error.message,
  };

  if (error.errors) response.errors = error.errors;
  if (process.env.NODE_ENV === 'development') response.stack = err.stack;

  res.status(error.statusCode).json(response);
};

/**
 * 404 handler – catches all unmatched routes.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};