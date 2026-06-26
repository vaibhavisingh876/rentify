// server/src/controllers/booking.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { createNotification } from '../services/notification.service';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const renterId = req.user!.id;
  const {
    itemId, startDate, endDate, deliveryAddress, specialInstructions,
  } = req.body;

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { owner: true },
  });

  if (!item) throw new AppError('Item not found', 404);
  if (!item.isAvailable || !item.isActive) throw new AppError('Item not available', 400);
  if (item.ownerId === renterId) throw new AppError('Cannot rent your own item', 400);

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) throw new AppError('End date must be after start date', 400);
  if (start < new Date()) throw new AppError('Start date cannot be in the past', 400);

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (totalDays < item.minRentalDays) {
    throw new AppError(`Minimum rental is ${item.minRentalDays} days`, 400);
  }
  if (totalDays > item.maxRentalDays) {
    throw new AppError(`Maximum rental is ${item.maxRentalDays} days`, 400);
  }

  // Check for conflicts
  const conflict = await prisma.booking.findFirst({
    where: {
      itemId,
      status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
      OR: [
        { startDate: { lte: end }, endDate: { gte: start } },
      ],
    },
  });

  if (conflict) throw new AppError('Item not available for selected dates', 409);

  const totalRentalCost = item.pricePerDay * totalDays;
  const totalAmount = totalRentalCost + item.securityDeposit;

  const qrPickupData = uuidv4();
  const qrReturnData = uuidv4();

  const booking = await prisma.booking.create({
    data: {
      itemId,
      renterId,
      lenderId: item.ownerId,
      startDate: start,
      endDate: end,
      totalDays,
      pricePerDay: item.pricePerDay,
      totalRentalCost,
      securityDeposit: item.securityDeposit,
      totalAmount,
      pickupAddress: item.addressLine || item.city,
      deliveryAddress,
      specialInstructions,
      qrCodePickup: qrPickupData,
      qrCodeReturn: qrReturnData,
      status: item.instantBooking ? 'CONFIRMED' : 'PENDING',
    },
    include: {
      item: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      renter: { select: { id: true, firstName: true, lastName: true, email: true } },
      lender: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  // Lock availability
  await prisma.availabilityBlock.create({
    data: {
      itemId,
      startDate: start,
      endDate: end,
      bookingId: booking.id,
      reason: 'Booking',
    },
  });

  // Create chat for booking
  const chat = await prisma.chat.create({
    data: {
      bookingId: booking.id,
      participants: {
        create: [
          { userId: renterId },
          { userId: item.ownerId },
        ],
      },
    },
  });

  // Notifications
  await createNotification({
    userId: item.ownerId,
    type: 'BOOKING_REQUEST',
    title: 'New Booking Request',
    message: `${req.user!.firstName || 'Someone'} wants to rent your ${item.title}`,
    data: { bookingId: booking.id, itemId },
  });

  res.status(201).json({
    success: true,
    message: item.instantBooking ? 'Booking confirmed!' : 'Booking request sent!',
    data: { ...booking, chatId: chat.id },
  });
});

export const getBookings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { page = '1', limit = '10', status } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = { renterId: userId };
  if (status) where.status = status;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        item: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            category: true,
          },
        },
        lender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});

export const getUserBookings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { status } = req.query;

  const where: any = { renterId: userId };
  if (status) where.status = status;

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      item: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: true,
        },
      },
      lender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  res.json({ success: true, data: bookings });
});

export const getLenderBookings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { status } = req.query;

  const where: any = { lenderId: userId };
  if (status) where.status = status;

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      item: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: true,
        },
      },
      renter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  res.json({ success: true, data: bookings });
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      item: { include: { images: { orderBy: { sortOrder: 'asc' } }, category: true } },
      renter: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, trustScore: true } },
      lender: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, trustScore: true } },
      payments: true,
      reviews: { include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
      chat: true,
      damageReports: true,
    },
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.renterId !== userId && booking.lenderId !== userId && req.user!.role !== 'ADMIN') {
    throw new AppError('Unauthorized', 403);
  }

  res.json({ success: true, data: booking });
});

export const updateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { status, reason } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { item: true, renter: true },
  });

  if (!booking) throw new AppError('Booking not found', 404);

  const allowedTransitions: Record<string, string[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED', 'LATE_RETURN', 'DISPUTED'],
    LATE_RETURN: ['COMPLETED', 'DISPUTED'],
  };

  const allowed = allowedTransitions[booking.status] || [];
  if (!allowed.includes(status)) {
    throw new AppError(`Cannot transition from ${booking.status} to ${status}`, 400);
  }

  // Only lender can confirm/activate, admin can do anything
  if (['CONFIRMED'].includes(status) && booking.lenderId !== userId && req.user!.role !== 'ADMIN') {
    throw new AppError('Only the lender can confirm bookings', 403);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      status,
      cancellationReason: reason || null,
      cancelledBy: ['CANCELLED'].includes(status) ? userId : null,
    },
  });

  if (status === 'CONFIRMED') {
    await createNotification({
      userId: booking.renterId,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking Confirmed!',
      message: `Your booking for ${booking.item.title} has been confirmed.`,
      data: { bookingId: id },
    });
  }

  if (status === 'COMPLETED') {
    await prisma.item.update({
      where: { id: booking.itemId },
      data: { totalRentals: { increment: 1 } },
    });
    await prisma.userTrustScore.update({
      where: { userId: booking.renterId },
      data: { completedRentals: { increment: 1 }, score: { increment: 5 } },
    });
  }

  res.json({ success: true, message: `Booking ${status.toLowerCase()}`, data: updatedBooking });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { reason } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.renterId !== userId && booking.lenderId !== userId) throw new AppError('Unauthorized', 403);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw new AppError('Booking cannot be cancelled', 400);

  await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED', cancellationReason: reason, cancelledBy: userId },
  });

  // Remove availability block
  await prisma.availabilityBlock.deleteMany({ where: { bookingId: id } });

  // Update trust score for cancellations
  await prisma.userTrustScore.update({
    where: { userId },
    data: { cancellations: { increment: 1 }, score: { decrement: 3 } },
  });

  res.json({ success: true, message: 'Booking cancelled' });
});

export const confirmPickup = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { qrCode } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.lenderId !== userId) throw new AppError('Only lender can confirm pickup', 403);
  if (booking.status !== 'CONFIRMED') throw new AppError('Booking must be confirmed first', 400);
  if (booking.qrCodePickup !== qrCode) throw new AppError('Invalid QR code', 400);

  await prisma.booking.update({
    where: { id },
    data: { status: 'ACTIVE', pickedUpAt: new Date() },
  });

  await createNotification({
    userId: booking.renterId,
    type: 'BOOKING_CONFIRMED',
    title: 'Item Picked Up',
    message: 'Pickup confirmed. Enjoy your rental!',
    data: { bookingId: id },
  });

  res.json({ success: true, message: 'Pickup confirmed' });
});

export const confirmReturn = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { qrCode } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.lenderId !== userId) throw new AppError('Only lender can confirm return', 403);
  if (!['ACTIVE', 'LATE_RETURN'].includes(booking.status)) throw new AppError('Invalid booking status', 400);
  if (booking.qrCodeReturn !== qrCode) throw new AppError('Invalid QR code', 400);

  const now = new Date();
  const isLate = now > booking.endDate;

  await prisma.booking.update({
    where: { id },
    data: { status: 'COMPLETED', returnedAt: now },
  });

  await prisma.item.update({ where: { id: booking.itemId }, data: { totalRentals: { increment: 1 } } });
  await prisma.availabilityBlock.deleteMany({ where: { bookingId: id } });

  res.json({ success: true, message: 'Return confirmed', data: { isLate } });
});

export const extendBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { newEndDate } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { item: true },
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.renterId !== userId) throw new AppError('Only renter can extend', 403);
  if (booking.status !== 'ACTIVE') throw new AppError('Only active bookings can be extended', 400);

  const newEnd = new Date(newEndDate);
  if (newEnd <= booking.endDate) throw new AppError('New end date must be after current end date', 400);

  // Check for conflicts with new dates
  const conflict = await prisma.booking.findFirst({
    where: {
      itemId: booking.itemId,
      id: { not: id },
      status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
      startDate: { lte: newEnd },
      endDate: { gte: booking.endDate },
    },
  });

  if (conflict) throw new AppError('Item not available for extension', 409);

  const additionalDays = Math.ceil((newEnd.getTime() - booking.endDate.getTime()) / (1000 * 60 * 60 * 24));
  const additionalCost = additionalDays * booking.item.pricePerDay;

  await prisma.booking.update({
    where: { id },
    data: {
      endDate: newEnd,
      totalDays: booking.totalDays + additionalDays,
      totalRentalCost: booking.totalRentalCost + additionalCost,
      totalAmount: booking.totalAmount + additionalCost,
      extendedUntil: newEnd,
    },
  });

  await prisma.availabilityBlock.updateMany({
    where: { bookingId: id },
    data: { endDate: newEnd },
  });

  res.json({ success: true, message: 'Booking extended', data: { additionalDays, additionalCost } });
});

export const generateQRCode = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type = 'pickup' } = req.query;
  const userId = req.user!.id;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.renterId !== userId && booking.lenderId !== userId) throw new AppError('Unauthorized', 403);

  const qrData = type === 'pickup' ? booking.qrCodePickup : booking.qrCodeReturn;
  if (!qrData) throw new AppError('QR code not available', 404);

  const qrDataURL = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    color: { dark: '#10b981', light: '#ffffff' },
  });

  res.json({ success: true, data: { qrCode: qrDataURL, code: qrData, type } });
});