import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { BookingStatus } from '@prisma/client';

export const createBookingSchema = z.object({
  itemId: z.string({ required_error: 'Item ID is required' }).cuid('Invalid item ID'),
  startDate: z
    .string({ required_error: 'Start date is required' })
    .datetime({ message: 'Invalid start date format (ISO 8601 required)' }),
  endDate: z
    .string({ required_error: 'End date is required' })
    .datetime({ message: 'Invalid end date format (ISO 8601 required)' }),
  deliveryAddress: z.string().max(500).optional(),
  specialInstructions: z.string().max(1000).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus, { required_error: 'Status is required' }),
  reason: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is required' })
    .min(10, 'Please provide a reason with at least 10 characters')
    .max(500, 'Reason too long'),
});

export const confirmPickupSchema = z.object({
  qrCode: z.string({ required_error: 'QR code is required' }).min(1),
});

export const confirmReturnSchema = z.object({
  qrCode: z.string({ required_error: 'QR code is required' }).min(1),
});

export const extendBookingSchema = z.object({
  newEndDate: z
    .string({ required_error: 'New end date is required' })
    .datetime({ message: 'Invalid date format (ISO 8601 required)' }),
});

export const bookingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: z.nativeEnum(BookingStatus).optional(),
});

// ─── Middleware exports ───────────────────────────────────────────────────────
export const validateCreateBooking = validate(createBookingSchema);
export const validateUpdateBookingStatus = validate(updateBookingStatusSchema);
export const validateCancelBooking = validate(cancelBookingSchema);
export const validateConfirmPickup = validate(confirmPickupSchema);
export const validateConfirmReturn = validate(confirmReturnSchema);
export const validateExtendBooking = validate(extendBookingSchema);