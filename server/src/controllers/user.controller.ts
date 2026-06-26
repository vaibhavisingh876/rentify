// server/src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { deleteFromCloudinary } from '../config/cloudinary';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      trustScore: true,
      _count: {
        select: {
          items: { where: { isActive: true } },
          bookingsAsRenter: true,
          bookingsAsLender: true,
          reviewsReceived: true,
          wishlistItems: true,
        },
      },
    },
  });
  if (!user) throw new AppError('User not found', 404);
  const { passwordHash, ...userWithoutPassword } = user;
  res.json({ success: true, data: userWithoutPassword });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const {
    firstName, lastName, bio, city, state, country, pincode,
    addressLine1, addressLine2, latitude, longitude,
  } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      firstName, lastName, bio, city, state, country, pincode,
      addressLine1, addressLine2,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
    },
    include: { trustScore: true },
  });

  const { passwordHash, ...userWithoutPassword } = user;
  res.json({ success: true, message: 'Profile updated', data: userWithoutPassword });
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as any;
  if (!file) throw new AppError('No file uploaded', 400);

  const oldUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (oldUser?.avatarUrl) {
    // Delete old avatar from Cloudinary - extract public ID from URL
    const parts = oldUser.avatarUrl.split('/');
    const publicId = parts[parts.length - 1].split('.')[0];
    await deleteFromCloudinary(`rentify/avatars/${publicId}`).catch(console.error);
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatarUrl: file.path },
  });

  res.json({ success: true, message: 'Avatar updated', data: { avatarUrl: user.avatarUrl } });
});

export const deleteAvatar = asyncHandler(async (req: Request, res: Response) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: null } });
  res.json({ success: true, message: 'Avatar removed' });
});

export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const [rentalCount, lendingCount, totalRevenue, reviewCount] = await Promise.all([
    prisma.booking.count({ where: { renterId: userId, status: 'COMPLETED' } }),
    prisma.booking.count({ where: { lenderId: userId, status: 'COMPLETED' } }),
    prisma.payment.aggregate({ where: { booking: { lenderId: userId }, status: 'COMPLETED', type: 'RENTAL' }, _sum: { amount: true } }),
    prisma.review.count({ where: { revieweeId: userId } }),
  ]);

  res.json({
    success: true,
    data: {
      completedRentals: rentalCount,
      completedLendings: lendingCount,
      totalRevenue: totalRevenue._sum.amount || 0,
      totalReviews: reviewCount,
    },
  });
});

export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await prisma.review.findMany({
    where: { revieweeId: req.user!.id },
    include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }, item: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: reviews });
});

export const getUserTrustScore = asyncHandler(async (req: Request, res: Response) => {
  const trustScore = await prisma.userTrustScore.findUnique({ where: { userId: req.user!.id } });
  res.json({ success: true, data: trustScore });
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, city, state } = req.body;
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { latitude: parseFloat(latitude), longitude: parseFloat(longitude), city, state },
  });
  res.json({ success: true, message: 'Location updated' });
});

export const deactivateAccount = asyncHandler(async (req: Request, res: Response) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { isActive: false } });
  await prisma.refreshToken.updateMany({ where: { userId: req.user!.id }, data: { isRevoked: true } });
  res.json({ success: true, message: 'Account deactivated' });
});

export const getPublicProfile = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, firstName: true, lastName: true, username: true, avatarUrl: true,
      bio: true, city: true, state: true, createdAt: true, isEmailVerified: true,
      isPhoneVerified: true, lastSeen: true,
      trustScore: true,
      items: {
        where: { isActive: true, isAvailable: true },
        take: 8,
        include: { images: { where: { isPrimary: true }, take: 1 }, category: true },
      },
      reviewsReceived: {
        take: 5,
        include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { items: { where: { isActive: true } }, reviewsReceived: true, bookingsAsLender: { where: { status: 'COMPLETED' } } },
      },
    },
  });
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});