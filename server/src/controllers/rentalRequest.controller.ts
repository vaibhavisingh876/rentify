import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { RequestStatus } from '@prisma/client';

export const createRentalRequest = asyncHandler(async (req: Request, res: Response) => {
  const requesterId = req.user!.id;
  const {
    title,
    description,
    categoryId,
    priceRange,
    startDate,
    endDate,
    latitude,
    longitude,
    city,
    radius,
  } = req.body;

  if (!title) throw new AppError('Title is required', 400);
  if (!description) throw new AppError('Description is required', 400);
  if (!startDate) throw new AppError('Start date is required', 400);
  if (!endDate) throw new AppError('End date is required', 400);

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) throw new AppError('End date must be after start date', 400);
  if (start < new Date()) throw new AppError('Start date cannot be in the past', 400);

  // Expires at the start date of the request
  const expiresAt = new Date(start);

  const rentalRequest = await prisma.rentalRequest.create({
    data: {
      requesterId,
      title: title.trim(),
      description: description.trim(),
      categoryId: categoryId || null,
      priceRange: priceRange || null,
      startDate: start,
      endDate: end,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      city: city || null,
      radius: radius ? parseFloat(radius) : 5,
      expiresAt,
    },
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true,
          city: true,
          trustScore: true,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    message: 'Rental request posted successfully',
    data: rentalRequest,
  });
});

export const getRentalRequests = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '12',
    status,
    categoryId,
    city,
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {
    expiresAt: { gt: new Date() }, // only non-expired by default
  };

  if (status) {
    where.status = status as RequestStatus;
  } else {
    where.status = RequestStatus.OPEN;
  }

  if (categoryId) where.categoryId = categoryId;
  if (city) where.city = { contains: city as string, mode: 'insensitive' };

  const [requests, total] = await Promise.all([
    prisma.rentalRequest.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
            city: true,
            trustScore: true,
          },
        },
      },
    }),
    prisma.rentalRequest.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      },
    },
  });
});

export const getRentalRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const rentalRequest = await prisma.rentalRequest.findUnique({
    where: { id },
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true,
          city: true,
          state: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          trustScore: true,
        },
      },
    },
  });

  if (!rentalRequest) throw new AppError('Rental request not found', 404);

  res.json({ success: true, data: rentalRequest });
});

export const updateRentalRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const rentalRequest = await prisma.rentalRequest.findUnique({ where: { id } });
  if (!rentalRequest) throw new AppError('Rental request not found', 404);
  if (rentalRequest.requesterId !== userId && req.user!.role !== 'ADMIN') {
    throw new AppError('Unauthorized', 403);
  }
  if (rentalRequest.status !== RequestStatus.OPEN) {
    throw new AppError('Only open requests can be updated', 400);
  }

  const {
    title,
    description,
    categoryId,
    priceRange,
    startDate,
    endDate,
    latitude,
    longitude,
    city,
    radius,
    status,
  } = req.body;

  const updateData: any = {};
  if (title) updateData.title = title.trim();
  if (description) updateData.description = description.trim();
  if (categoryId !== undefined) updateData.categoryId = categoryId || null;
  if (priceRange !== undefined) updateData.priceRange = priceRange || null;
  if (startDate) {
    const start = new Date(startDate);
    if (start < new Date()) throw new AppError('Start date cannot be in the past', 400);
    updateData.startDate = start;
    updateData.expiresAt = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    const effectiveStart = updateData.startDate || rentalRequest.startDate;
    if (end <= effectiveStart) throw new AppError('End date must be after start date', 400);
    updateData.endDate = end;
  }
  if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
  if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
  if (city !== undefined) updateData.city = city || null;
  if (radius !== undefined) updateData.radius = parseFloat(radius);
  if (status && req.user!.role === 'ADMIN') updateData.status = status;

  const updated = await prisma.rentalRequest.update({
    where: { id },
    data: updateData,
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  });

  res.json({ success: true, message: 'Rental request updated', data: updated });
});

export const deleteRentalRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const rentalRequest = await prisma.rentalRequest.findUnique({ where: { id } });
  if (!rentalRequest) throw new AppError('Rental request not found', 404);
  if (rentalRequest.requesterId !== userId && req.user!.role !== 'ADMIN') {
    throw new AppError('Unauthorized', 403);
  }

  await prisma.rentalRequest.update({
    where: { id },
    data: { status: RequestStatus.CANCELLED },
  });

  res.json({ success: true, message: 'Rental request cancelled' });
});

export const getNearbyRentalRequests = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius = '10', limit = '20', categoryId } = req.query;

  if (!lat || !lng) throw new AppError('Location (lat, lng) is required', 400);

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  const radiusNum = parseFloat(radius as string);

  // Bounding box approximation
  const latDiff = radiusNum / 111;
  const lngDiff = radiusNum / (111 * Math.cos((latNum * Math.PI) / 180));

  const where: any = {
    status: RequestStatus.OPEN,
    expiresAt: { gt: new Date() },
    latitude: { gte: latNum - latDiff, lte: latNum + latDiff },
    longitude: { gte: lngNum - lngDiff, lte: lngNum + lngDiff },
  };

  if (categoryId) where.categoryId = categoryId;

  const requests = await prisma.rentalRequest.findMany({
    where,
    take: parseInt(limit as string, 10),
    orderBy: { createdAt: 'desc' },
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true,
          trustScore: true,
        },
      },
    },
  });

  // Attach distance
  const requestsWithDistance = requests
    .map((r) => {
      if (!r.latitude || !r.longitude) return { ...r, distance: null };
      const R = 6371;
      const dLat = ((r.latitude - latNum) * Math.PI) / 180;
      const dLng = ((r.longitude - lngNum) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((latNum * Math.PI) / 180) *
          Math.cos((r.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...r, distance: Math.round(distance * 10) / 10 };
    })
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

  res.json({ success: true, data: requestsWithDistance });
});