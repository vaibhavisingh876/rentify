// server/src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { createNotification } from '../services/notification.service';
import { PaymentType } from '@prisma/client';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { bookingId, type } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { item: true },
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.renterId !== userId) throw new AppError('Unauthorized', 403);

  let amount: number;
  let description: string;

  switch (type as PaymentType) {
    case 'RENTAL':
      amount = booking.totalRentalCost;
      description = `Rental payment for ${booking.item.title}`;
      break;
    case 'SECURITY_DEPOSIT':
      amount = booking.securityDeposit;
      description = `Security deposit for ${booking.item.title}`;
      break;
    default:
      amount = booking.totalAmount;
      description = `Payment for ${booking.item.title}`;
  }

  const amountInPaise = Math.round(amount * 100);

  const razorpayOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `booking_${bookingId}_${Date.now()}`,
    notes: { bookingId, userId, type },
  });

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency: 'INR',
      type: type as PaymentType,
      description,
      status: 'PENDING',
    },
  });

  res.json({
    success: true,
    data: {
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      paymentId: payment.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId } = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    throw new AppError('Payment verification failed', 400);
  }

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      razorpayPaymentId,
      razorpaySignature,
      status: 'COMPLETED',
    },
    include: { booking: { include: { item: true, lender: true } } },
  });

  // Update booking status if it's pending
  if (payment.booking.status === 'PENDING') {
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: payment.booking.item.instantBooking ? 'CONFIRMED' : 'CONFIRMED' },
    });
  }

  await createNotification({
    userId: payment.booking.lenderId,
    type: 'PAYMENT_SUCCESS',
    title: 'Payment Received',
    message: `Payment of ₹${payment.amount} received for ${payment.booking.item.title}`,
    data: { bookingId: payment.bookingId, paymentId: payment.id },
  });

  res.json({ success: true, message: 'Payment verified successfully', data: payment });
});

export const getPayments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: { item: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
        },
      },
    }),
    prisma.payment.count({ where: { userId } }),
  ]);

  res.json({
    success: true,
    data: {
      payments,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          item: { include: { images: { orderBy: { sortOrder: 'asc' } } } },
          renter: { select: { id: true, firstName: true, lastName: true, email: true } },
          lender: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.userId !== userId && req.user!.role !== 'ADMIN') throw new AppError('Unauthorized', 403);

  res.json({ success: true, data: payment });
});

export const requestRefund = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { reason } = req.body;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { booking: true },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.userId !== userId) throw new AppError('Unauthorized', 403);
  if (payment.status !== 'COMPLETED') throw new AppError('Payment cannot be refunded', 400);

  if (!payment.razorpayPaymentId) throw new AppError('No payment ID found', 400);

  // Process refund via Razorpay
  try {
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(payment.amount * 100),
      notes: { reason, bookingId: payment.bookingId },
    });

    await prisma.payment.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        refundId: refund.id,
        refundedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Refund initiated', data: { refundId: refund.id } });
  } catch (error: any) {
    throw new AppError(`Refund failed: ${error.message}`, 500);
  }
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          item: true,
          renter: { select: { firstName: true, lastName: true, email: true, phone: true } },
          lender: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.userId !== userId && req.user!.role !== 'ADMIN') throw new AppError('Unauthorized', 403);

  const invoice = {
    invoiceNumber: `INV-${payment.id.slice(-8).toUpperCase()}`,
    date: payment.createdAt,
    payment: {
      id: payment.id,
      razorpayPaymentId: payment.razorpayPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      type: payment.type,
    },
    booking: {
      id: payment.booking.id,
      item: payment.booking.item.title,
      startDate: payment.booking.startDate,
      endDate: payment.booking.endDate,
      totalDays: payment.booking.totalDays,
      pricePerDay: payment.booking.pricePerDay,
    },
    renter: payment.booking.renter,
    lender: payment.booking.lender,
    breakdown: {
      rentalCost: payment.booking.totalRentalCost,
      securityDeposit: payment.booking.securityDeposit,
      total: payment.booking.totalAmount,
    },
  };

  res.json({ success: true, data: invoice });
});

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const { event, payload } = req.body;

  switch (event) {
    case 'payment.captured':
      const paymentEntity = payload.payment.entity;
      await prisma.payment.updateMany({
        where: { razorpayOrderId: paymentEntity.order_id },
        data: {
          razorpayPaymentId: paymentEntity.id,
          status: 'COMPLETED',
        },
      });
      break;

    case 'payment.failed':
      const failedPayment = payload.payment.entity;
      await prisma.payment.updateMany({
        where: { razorpayOrderId: failedPayment.order_id },
        data: {
          status: 'FAILED',
          failureReason: failedPayment.error_description,
        },
      });
      break;

    case 'refund.processed':
      const refundEntity = payload.refund.entity;
      await prisma.payment.updateMany({
        where: { razorpayPaymentId: refundEntity.payment_id },
        data: {
          status: 'REFUNDED',
          refundId: refundEntity.id,
          refundedAt: new Date(),
        },
      });
      break;
  }

  res.json({ success: true });
});