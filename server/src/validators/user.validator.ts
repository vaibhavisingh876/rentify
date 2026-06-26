import { z } from 'zod';
import { validate } from '../middlewares/validate';

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name too long')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name too long')
    .trim()
    .optional(),
  bio: z.string().max(500, 'Bio too long').trim().optional(),
  city: z.string().max(100).trim().optional(),
  state: z.string().max(100).trim().optional(),
  country: z.string().max(100).trim().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Invalid pincode (must be 6 digits)')
    .optional(),
  addressLine1: z.string().max(300).trim().optional(),
  addressLine2: z.string().max(300).trim().optional(),
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
});

export const updateLocationSchema = z.object({
  latitude: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .refine((v) => !isNaN(v) && v >= -90 && v <= 90, 'Invalid latitude'),
  longitude: z
    .union([z.string(), z.number()])
    .transform((v) => parseFloat(String(v)))
    .refine((v) => !isNaN(v) && v >= -180 && v <= 180, 'Invalid longitude'),
  city: z.string().max(100).trim().optional(),
  state: z.string().max(100).trim().optional(),
});

export const usernameParamSchema = z.object({
  username: z
    .string({ required_error: 'Username is required' })
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Invalid username format'),
});

// ─── Middleware exports ───────────────────────────────────────────────────────
export const validateUpdateProfile = validate(updateProfileSchema);
export const validateUpdateLocation = validate(updateLocationSchema);