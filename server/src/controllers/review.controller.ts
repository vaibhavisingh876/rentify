// server/src/controllers/review.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const reviewerId = req.user!.id;
  const { bookingId, rating, comment, isForItem } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { item: true },
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status !== 'COMPLETED') throw new AppError('Booking must be completed to review', 400);
  if (booking.renterId !== reviewerId && booking.lenderId !== reviewerId) throw new AppError('Unauthorized', 403);

  const revieweeId = reviewerId === booking.renterId ? booking.lenderId : booking.renterId;

  const existingReview = await prisma.review.findUnique({
    where: { bookingId_reviewerId_isForItem: { bookingId, reviewerId, isForItem: isForItem || false } },
  });

  if (existingReview) throw new AppError('Already reviewed', 409);

  const review = await prisma.review.create({
    data: {
      bookingId,
      itemId: isForItem ? booking.itemId : null,
      reviewerId,
      revieweeId,
      rating: parseInt(rating),
      comment,
      isForItem: isForItem || false,
    },
    include: {
      reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  // Update user's average rating
  const reviews = await prisma.review.aggregate({
    where: { revieweeId, isForItem: false },
    _avg: { rating: true },
    _count: true,
  });

  await prisma.userTrustScore.update({
    where: { userId: revieweeId },
    data: {
      averageRating: reviews._avg.rating || 0,
      totalReviews: reviews._count,
    },
  });

  // Update item rating if item review
  if (isForItem) {
    const itemReviews = await prisma.review.aggregate({
      where: { itemId: booking.itemId, isForItem: true },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.item.update({
      where: { id: booking.itemId },
      data: { averageRating: itemReviews._avg.rating || 0, totalReviews: itemReviews._count },
    });
  }

  res.status(201).json({ success: true, message: 'Review submitted', data: review });
});

export const getItemReviews = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const reviews = await prisma.review.findMany({
    where: { itemId, isForItem: true },
    include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: reviews });
});

export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const reviews = await prisma.review.findMany({
    where: { revieweeId: userId, isForItem: false },
    include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: reviews });
});

export const getReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    include: {
      reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      reviewee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });
  if (!review) throw new AppError('Review not found', 404);
  res.json({ success: true, data: review });
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) throw new AppError('Review not found', 404);
  if (review.reviewerId !== req.user!.id && req.user!.role !== 'ADMIN') throw new AppError('Unauthorized', 403);
  await prisma.review.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Review deleted' });
});