import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { PaymentType } from '@prisma/client';

export const createOrderSchema = z.object({
  bookingId: z.string({ required_error: 'Booking ID is required' }).cuid('Invalid booking ID'),
  type: z.nativeEnum(PaymentType, { required_error: 'Payment type is required' }),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z
    .string({ required_error: 'Razorpay order ID is required' })
    .min(1, 'Invalid order ID'),
  razorpayPaymentId: z
    .string({ required_error: 'Razorpay payment ID is required' })
    .min(1, 'Invalid payment ID'),
  razorpaySignature: z
    .string({ required_error: 'Razorpay signature is required' })
    .min(1, 'Invalid signature'),
  paymentId: z
    .string({ required_error: 'Payment ID is required' })
    .cuid('Invalid payment ID'),
});

export const requestRefundSchema = z.object({
  reason: z
    .string({ required_error: 'Refund reason is required' })
    .min(10, 'Please provide a reason with at least 10 characters')
    .max(500, 'Reason too long')
    .trim(),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// ─── Middleware exports ───────────────────────────────────────────────────────
export const validateCreateOrder = validate(createOrderSchema);
export const validateVerifyPayment = validate(verifyPaymentSchema);
export const validateRequestRefund = validate(requestRefundSchema);