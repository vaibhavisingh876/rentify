import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { ItemCondition, DeliveryOption } from '@prisma/client';

export const createItemSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(5, 'Title must be at least 5 characters')
    .max(150, 'Title too long')
    .trim(),
  description: z
    .string({ required_error: 'Description is required' })
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description too long')
    .trim(),
  categoryId: z.string({ required_error: 'Category is required' }).cuid('Invalid category ID'),
  pricePerDay: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .refine((v) => !isNaN(v) && v > 0, 'Price per day must be a positive number'),
  pricePerWeek: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .optional(),
  pricePerMonth: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .optional(),
  securityDeposit: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .refine((v) => !isNaN(v) && v >= 0, 'Security deposit must be non-negative')
    .optional()
    .default('0'),
  condition: z.nativeEnum(ItemCondition).default(ItemCondition.GOOD),
  deliveryOption: z.nativeEnum(DeliveryOption).default(DeliveryOption.PICKUP_ONLY),
  instantBooking: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
  minRentalDays: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => !isNaN(v) && v >= 1, 'Minimum rental days must be at least 1')
    .optional()
    .default('1'),
  maxRentalDays: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => !isNaN(v) && v >= 1, 'Maximum rental days must be at least 1')
    .optional()
    .default('30'),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Invalid pincode (must be 6 digits)')
    .optional(),
  addressLine: z.string().max(300).optional(),
  latitude: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .refine((v) => !isNaN(v) && v >= -90 && v <= 90, 'Invalid latitude')
    .optional(),
  longitude: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .refine((v) => !isNaN(v) && v >= -180 && v <= 180, 'Invalid longitude')
    .optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  specifications: z.union([z.record(z.unknown()), z.string()]).optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const itemQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
  category: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  condition: z.nativeEnum(ItemCondition).optional(),
  deliveryOption: z.nativeEnum(DeliveryOption).optional(),
  instantBooking: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  city: z.string().optional(),
  search: z.string().max(200).optional(),
  sort: z
    .enum(['newest', 'price_asc', 'price_desc', 'rating', 'popular'])
    .default('newest'),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce
    .number()
    .min(-90)
    .max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(100).default(10),
  limit: z.coerce.number().positive().max(50).default(20),
  category: z.string().optional(),
});

export const availabilityQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
});

export const blockDatesSchema = z.object({
  isAvailable: z.boolean().optional(),
  blockDates: z
    .array(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        reason: z.string().max(200).optional(),
      }),
    )
    .optional(),
});

// ─── Middleware exports ───────────────────────────────────────────────────────
export const validateCreateItem = validate(createItemSchema);
export const validateUpdateItem = validate(updateItemSchema);
export const validateItemQuery = validate(itemQuerySchema, 'query');
export const validateNearbyQuery = validate(nearbyQuerySchema, 'query');