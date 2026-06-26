import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { deleteFromCloudinary } from '../config/cloudinary';
import { TrustBadge } from '@prisma/client';

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalUsers,
    totalItems,
    totalBookings,
    totalRevenue,
    activeBookings,
    pendingBookings,
    newUsersToday,
    newItemsToday,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.item.count({ where: { isActive: true } }),
    prisma.booking.count(),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', type: 'RENTAL' },
      _sum: { amount: true },
    }),
    prisma.booking.count({ where: { status: 'ACTIVE' } }),
    prisma.booking.count({ where: { status: 'PENDING' } }),
    prisma.user.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.item.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      totalItems,
      totalBookings,
      totalRevenue: totalRevenue._sum.amount || 0,
      activeBookings,
      pendingBookings,
      newUsersToday,
      newItemsToday,
    },
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────────
export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { period = '30' } = req.query;
  const days = parseInt(period as string, 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Revenue per day (last N days)
  const revenueData = await prisma.payment.findMany({
    where: { status: 'COMPLETED', type: 'RENTAL', createdAt: { gte: since } },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Bookings per day
  const bookingsData = await prisma.booking.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  // Registrations per day
  const registrations = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Top categories by booking count
  const topCategories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { items: { where: { bookings: { some: { createdAt: { gte: since } } } } } } },
    },
    orderBy: { sortOrder: 'asc' },
    take: 8,
  });

  // Booking status breakdown
  const statusBreakdown = await prisma.booking.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { createdAt: { gte: since } },
  });

  res.json({
    success: true,
    data: {
      revenue: revenueData,
      bookings: bookingsData,
      registrations,
      topCategories,
      statusBreakdown,
    },
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search,
    role,
    isBanned,
    isActive,
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: search as string, mode: 'insensitive' } },
      { firstName: { contains: search as string, mode: 'insensitive' } },
      { lastName: { contains: search as string, mode: 'insensitive' } },
      { username: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = role;
  if (isBanned !== undefined) where.isBanned = isBanned === 'true';
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        isActive: true,
        isBanned: true,
        banReason: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        city: true,
        createdAt: true,
        lastSeen: true,
        trustScore: true,
        _count: {
          select: {
            items: true,
            bookingsAsRenter: true,
            bookingsAsLender: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

export const getUserDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      trustScore: true,
      items: {
        where: { isActive: true },
        take: 10,
        include: { images: { where: { isPrimary: true }, take: 1 }, category: true },
        orderBy: { createdAt: 'desc' },
      },
      bookingsAsRenter: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { item: { select: { title: true } } },
      },
      bookingsAsLender: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { item: { select: { title: true } } },
      },
      payments: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          items: true,
          bookingsAsRenter: true,
          bookingsAsLender: true,
          reviewsReceived: true,
        },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  const { passwordHash, ...userWithoutPassword } = user;
  res.json({ success: true, data: userWithoutPassword });
});

export const banUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) throw new AppError('Ban reason is required', 400);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'ADMIN') throw new AppError('Cannot ban an admin user', 403);

  await prisma.user.update({
    where: { id },
    data: { isBanned: true, banReason: reason, isActive: false },
  });

  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId: id },
    data: { isRevoked: true },
  });

  res.json({ success: true, message: 'User banned successfully' });
});

export const unbanUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('User not found', 404);

  await prisma.user.update({
    where: { id },
    data: { isBanned: false, banReason: null, isActive: true },
  });

  res.json({ success: true, message: 'User unbanned successfully' });
});

// ─── Items ────────────────────────────────────────────────────────────────────
export const getItems = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', search, category, isActive, isFeatured } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {};
  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = { slug: category };
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        category: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true, username: true } },
        _count: { select: { bookings: true, reviews: true } },
      },
    }),
    prisma.item.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const item = await prisma.item.findUnique({ where: { id }, include: { images: true } });
  if (!item) throw new AppError('Item not found', 404);

  for (const image of item.images) {
    await deleteFromCloudinary(image.publicId).catch(console.error);
  }

  await prisma.item.update({ where: { id }, data: { isActive: false } });

  res.json({ success: true, message: 'Item removed successfully' });
});

export const featureItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isFeatured } = req.body;

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw new AppError('Item not found', 404);

  await prisma.item.update({
    where: { id },
    data: { isFeatured: isFeatured ?? !item.isFeatured },
  });

  res.json({
    success: true,
    message: `Item ${isFeatured ?? !item.isFeatured ? 'featured' : 'unfeatured'} successfully`,
  });
});

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const getBookings = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', status } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {};
  if (status) where.status = status;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { include: { images: { where: { isPrimary: true }, take: 1 } } },
        renter: { select: { id: true, firstName: true, lastName: true, email: true } },
        lender: { select: { id: true, firstName: true, lastName: true, email: true } },
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

// ─── Payments ─────────────────────────────────────────────────────────────────
export const getPayments = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', status, type } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            item: { select: { title: true } },
            renter: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      payments,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const getReviews = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewee: { select: { id: true, firstName: true, lastName: true, email: true } },
        item: { select: { id: true, title: true } },
      },
    }),
    prisma.review.count(),
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw new AppError('Review not found', 404);

  await prisma.review.delete({ where: { id } });

  res.json({ success: true, message: 'Review deleted' });
});

// ─── Damage Reports ───────────────────────────────────────────────────────────
export const getDamageReports = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', status } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {};
  if (status) where.status = status;

  const [reports, total] = await Promise.all([
    prisma.damageReport.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: { select: { id: true, startDate: true, endDate: true } },
        item: { select: { id: true, title: true } },
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.damageReport.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      reports,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});

export const resolveDamageReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { resolution, status } = req.body;

  if (!resolution) throw new AppError('Resolution description is required', 400);
  if (!status) throw new AppError('Status is required', 400);

  const report = await prisma.damageReport.findUnique({ where: { id } });
  if (!report) throw new AppError('Damage report not found', 404);

  const updated = await prisma.damageReport.update({
    where: { id },
    data: { resolution, status, resolvedAt: new Date() },
  });

  res.json({ success: true, message: 'Damage report resolved', data: updated });
});

// ─── Rental Requests ──────────────────────────────────────────────────────────
export const getRentalRequests = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', status } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {};
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.rentalRequest.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.rentalRequest.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      requests,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});