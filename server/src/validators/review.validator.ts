import { z } from 'zod';
import { validate } from '../middlewares/validate';

export const createReviewSchema = z.object({
  bookingId: z.string({ required_error: 'Booking ID is required' }).cuid('Invalid booking ID'),
  rating: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => !isNaN(v) && v >= 1 && v <= 5, 'Rating must be between 1 and 5'),
  comment: z
    .string()
    .min(10, 'Comment must be at least 10 characters')
    .max(2000, 'Comment too long')
    .trim()
    .optional(),
  isForItem: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

export const reviewQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// ─── Middleware exports ───────────────────────────────────────────────────────
export const validateCreateReview = validate(createReviewSchema);