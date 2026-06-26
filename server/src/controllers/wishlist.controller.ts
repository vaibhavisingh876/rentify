// server/src/controllers/wishlist.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.wishlist.findMany({
    where: { userId: req.user!.id },
    include: {
      item: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: true,
          owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: items });
});

export const toggleWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const userId = req.user!.id;

  const existing = await prisma.wishlist.findUnique({ where: { userId_itemId: { userId, itemId } } });

  if (existing) {
    await prisma.wishlist.delete({ where: { userId_itemId: { userId, itemId } } });
    return res.json({ success: true, message: 'Removed from wishlist', data: { isWishlisted: false } });
  }

  await prisma.wishlist.create({ data: { userId, itemId } });
  res.json({ success: true, message: 'Added to wishlist', data: { isWishlisted: true } });
});

export const checkWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const userId = req.user!.id;
  const existing = await prisma.wishlist.findUnique({ where: { userId_itemId: { userId, itemId } } });
  res.json({ success: true, data: { isWishlisted: !!existing } });
});