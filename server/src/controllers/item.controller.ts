// server/src/controllers/item.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { deleteFromCloudinary } from '../config/cloudinary';
import slugify from '../utils/slugify';

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const {
    title, description, categoryId, pricePerDay, pricePerWeek, pricePerMonth,
    securityDeposit, condition, deliveryOption, instantBooking, minRentalDays,
    maxRentalDays, tags, specifications, latitude, longitude, city, state,
    pincode, addressLine,
  } = req.body;

  const files = req.files as Express.Multer.File[] & { path?: string; filename?: string }[];

  let slug = slugify(title);
  const existingSlug = await prisma.item.findUnique({ where: { slug } });
  if (existingSlug) slug = `${slug}-${Date.now()}`;

  const item = await prisma.item.create({
    data: {
      title,
      description,
      slug,
      ownerId,
      categoryId,
      pricePerDay: parseFloat(pricePerDay),
      pricePerWeek: pricePerWeek ? parseFloat(pricePerWeek) : null,
      pricePerMonth: pricePerMonth ? parseFloat(pricePerMonth) : null,
      securityDeposit: parseFloat(securityDeposit || '0'),
      condition,
      deliveryOption,
      instantBooking: instantBooking === 'true' || instantBooking === true,
      minRentalDays: parseInt(minRentalDays || '1'),
      maxRentalDays: parseInt(maxRentalDays || '30'),
      tags: Array.isArray(tags) ? tags : tags ? JSON.parse(tags) : [],
      specifications: specifications ? JSON.parse(specifications) : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      city, state, pincode, addressLine,
    },
    include: { category: true, owner: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
  });

  // Handle uploaded images from Cloudinary
  if (files && files.length > 0) {
    const imageData = (files as any[]).map((file: any, index: number) => ({
      itemId: item.id,
      url: file.path,
      publicId: file.filename,
      isPrimary: index === 0,
      sortOrder: index,
    }));

    await prisma.itemImage.createMany({ data: imageData });
  }

  const itemWithImages = await prisma.item.findUnique({
    where: { id: item.id },
    include: {
      images: true,
      category: true,
      owner: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, trustScore: true } },
    },
  });

  res.status(201).json({ success: true, message: 'Item listed successfully', data: itemWithImages });
});

export const getItems = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1', limit = '12', category, minPrice, maxPrice,
    condition, deliveryOption, instantBooking, city, sort = 'newest',
    search,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: any = { isActive: true, isAvailable: true };

  if (category) where.category = { slug: category };
  if (minPrice || maxPrice) {
    where.pricePerDay = {};
    if (minPrice) where.pricePerDay.gte = parseFloat(minPrice as string);
    if (maxPrice) where.pricePerDay.lte = parseFloat(maxPrice as string);
  }
  if (condition) where.condition = condition;
  if (deliveryOption) where.deliveryOption = deliveryOption;
  if (instantBooking === 'true') where.instantBooking = true;
  if (city) where.city = { contains: city as string, mode: 'insensitive' };
  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
      { tags: { has: search as string } },
    ];
  }

  const orderBy: any = {};
  switch (sort) {
    case 'price_asc': orderBy.pricePerDay = 'asc'; break;
    case 'price_desc': orderBy.pricePerDay = 'desc'; break;
    case 'rating': orderBy.averageRating = 'desc'; break;
    case 'popular': orderBy.totalRentals = 'desc'; break;
    case 'newest': default: orderBy.createdAt = 'desc'; break;
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip,
      take: limitNum,
      orderBy,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        category: true,
        owner: {
          select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, trustScore: true },
        },
        _count: { select: { reviews: true, bookings: true } },
      },
    }),
    prisma.item.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
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

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const item = await prisma.item.findFirst({
    where: { OR: [{ id }, { slug: id }], isActive: true },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      category: true,
      owner: {
        select: {
          id: true, firstName: true, lastName: true, username: true,
          avatarUrl: true, city: true, isPhoneVerified: true,
          isEmailVerified: true, createdAt: true, trustScore: true,
          _count: { select: { items: true, reviewsReceived: true } },
        },
      },
      reviews: {
        include: {
          reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: { select: { reviews: true, bookings: true, wishlistEntries: true } },
    },
  });

  if (!item) throw new AppError('Item not found', 404);

  // Increment view count
  await prisma.item.update({ where: { id: item.id }, data: { viewCount: { increment: 1 } } });

  res.json({ success: true, data: item });
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw new AppError('Item not found', 404);
  if (item.ownerId !== userId && req.user!.role !== 'ADMIN') {
    throw new AppError('Unauthorized', 403);
  }

  const files = req.files as any[];
  const {
    title, description, categoryId, pricePerDay, pricePerWeek, pricePerMonth,
    securityDeposit, condition, deliveryOption, instantBooking, minRentalDays,
    maxRentalDays, tags, specifications, latitude, longitude, city, state,
    pincode, addressLine, removeImages,
  } = req.body;

  const updateData: any = {};
  if (title) { updateData.title = title; updateData.slug = slugify(title); }
  if (description) updateData.description = description;
  if (categoryId) updateData.categoryId = categoryId;
  if (pricePerDay) updateData.pricePerDay = parseFloat(pricePerDay);
  if (pricePerWeek) updateData.pricePerWeek = parseFloat(pricePerWeek);
  if (pricePerMonth) updateData.pricePerMonth = parseFloat(pricePerMonth);
  if (securityDeposit !== undefined) updateData.securityDeposit = parseFloat(securityDeposit);
  if (condition) updateData.condition = condition;
  if (deliveryOption) updateData.deliveryOption = deliveryOption;
  if (instantBooking !== undefined) updateData.instantBooking = instantBooking === 'true' || instantBooking === true;
  if (minRentalDays) updateData.minRentalDays = parseInt(minRentalDays);
  if (maxRentalDays) updateData.maxRentalDays = parseInt(maxRentalDays);
  if (tags) updateData.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
  if (specifications) updateData.specifications = JSON.parse(specifications);
  if (latitude) updateData.latitude = parseFloat(latitude);
  if (longitude) updateData.longitude = parseFloat(longitude);
  if (city) updateData.city = city;
  if (state) updateData.state = state;
  if (pincode) updateData.pincode = pincode;
  if (addressLine) updateData.addressLine = addressLine;

  // Remove specified images
  if (removeImages) {
    const imageIds = Array.isArray(removeImages) ? removeImages : JSON.parse(removeImages);
    const imagesToDelete = await prisma.itemImage.findMany({
      where: { id: { in: imageIds }, itemId: id },
    });
    for (const img of imagesToDelete) {
      await deleteFromCloudinary(img.publicId);
    }
    await prisma.itemImage.deleteMany({ where: { id: { in: imageIds } } });
  }

  // Add new images
  if (files && files.length > 0) {
    const currentImagesCount = await prisma.itemImage.count({ where: { itemId: id } });
    const imageData = files.map((file: any, index: number) => ({
      itemId: id,
      url: file.path,
      publicId: file.filename,
      isPrimary: currentImagesCount === 0 && index === 0,
      sortOrder: currentImagesCount + index,
    }));
    await prisma.itemImage.createMany({ data: imageData });
  }

  const updatedItem = await prisma.item.update({
    where: { id },
    data: updateData,
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      category: true,
      owner: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
    },
  });

  res.json({ success: true, message: 'Item updated successfully', data: updatedItem });
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const item = await prisma.item.findUnique({ where: { id }, include: { images: true } });
  if (!item) throw new AppError('Item not found', 404);
  if (item.ownerId !== userId && req.user!.role !== 'ADMIN') throw new AppError('Unauthorized', 403);

  // Delete images from Cloudinary
  for (const image of item.images) {
    await deleteFromCloudinary(image.publicId).catch(console.error);
  }

  await prisma.item.update({ where: { id }, data: { isActive: false } });

  res.json({ success: true, message: 'Item deleted successfully' });
});

export const getUserItems = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { page = '1', limit = '12' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where: { ownerId: userId, isActive: true },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        category: true,
        _count: { select: { reviews: true, bookings: true } },
      },
    }),
    prisma.item.count({ where: { ownerId: userId, isActive: true } }),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } },
  });
});

export const getItemAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw new AppError('Item not found', 404);

  const blockedDates = await prisma.availabilityBlock.findMany({
    where: {
      itemId: id,
      OR: [
        { startDate: { lte: new Date(endDate as string) }, endDate: { gte: new Date(startDate as string) } },
      ],
    },
  });

  const activeBookings = await prisma.booking.findMany({
    where: {
      itemId: id,
      status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
      startDate: { lte: new Date(endDate as string) },
      endDate: { gte: new Date(startDate as string) },
    },
    select: { startDate: true, endDate: true, status: true },
  });

  res.json({
    success: true,
    data: {
      isAvailable: item.isAvailable,
      blockedDates,
      activeBookings,
    },
  });
});

export const updateItemAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { isAvailable, blockDates } = req.body;

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw new AppError('Item not found', 404);
  if (item.ownerId !== userId) throw new AppError('Unauthorized', 403);

  if (isAvailable !== undefined) {
    await prisma.item.update({ where: { id }, data: { isAvailable } });
  }

  if (blockDates) {
    await prisma.availabilityBlock.createMany({
      data: blockDates.map((block: { startDate: string; endDate: string; reason?: string }) => ({
        itemId: id,
        startDate: new Date(block.startDate),
        endDate: new Date(block.endDate),
        reason: block.reason,
      })),
    });
  }

  res.json({ success: true, message: 'Availability updated' });
});

export const getNearbyItems = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius = '10', limit = '20', category } = req.query;

  if (!lat || !lng) throw new AppError('Location required', 400);

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  const radiusNum = parseFloat(radius as string);

  // Haversine formula approximation using bounding box
  const latDiff = radiusNum / 111;
  const lngDiff = radiusNum / (111 * Math.cos((latNum * Math.PI) / 180));

  const where: any = {
    isActive: true,
    isAvailable: true,
    latitude: { gte: latNum - latDiff, lte: latNum + latDiff },
    longitude: { gte: lngNum - lngDiff, lte: lngNum + lngDiff },
  };

  if (category) where.category = { slug: category };

  const items = await prisma.item.findMany({
    where,
    take: parseInt(limit as string),
    orderBy: { createdAt: 'desc' },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      category: true,
      owner: { select: { id: true, firstName: true, username: true, avatarUrl: true, trustScore: true } },
    },
  });

  // Calculate distance for each item
  const itemsWithDistance = items.map(item => {
    if (!item.latitude || !item.longitude) return { ...item, distance: null };
    const R = 6371;
    const dLat = ((item.latitude - latNum) * Math.PI) / 180;
    const dLng = ((item.longitude - lngNum) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((latNum * Math.PI) / 180) * Math.cos((item.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { ...item, distance: Math.round(distance * 10) / 10 };
  }).sort((a, b) => (a.distance || 999) - (b.distance || 999));

  res.json({ success: true, data: itemsWithDistance });
});

export const getTrendingItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.item.findMany({
    where: { isActive: true, isAvailable: true },
    orderBy: { totalRentals: 'desc' },
    take: 12,
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      category: true,
      owner: { select: { id: true, firstName: true, username: true, avatarUrl: true } },
    },
  });

  res.json({ success: true, data: items });
});

export const getFeaturedItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.item.findMany({
    where: { isActive: true, isAvailable: true, isFeatured: true },
    take: 8,
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      category: true,
      owner: { select: { id: true, firstName: true, username: true, avatarUrl: true, trustScore: true } },
    },
  });

  res.json({ success: true, data: items });
});

export const getAISuggestedPrice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const item = await prisma.item.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!item) throw new AppError('Item not found', 404);

  // AI Price Suggestion Logic (rule-based with market data)
  const categoryAvgPrices: Record<string, number> = {
    'cameras-photography': 600,
    'electronics': 800,
    'audio-music': 500,
    'party-events': 700,
    'sports-equipment': 400,
    'gaming': 600,
    'power-tools': 350,
    'vehicles': 1200,
    'dresses-clothing': 300,
    'home-appliances': 600,
    'books-education': 80,
    'art-craft': 250,
  };

  const conditionMultipliers: Record<string, number> = {
    BRAND_NEW: 1.3,
    LIKE_NEW: 1.15,
    GOOD: 1.0,
    FAIR: 0.85,
    POOR: 0.65,
  };

  const basePrice = categoryAvgPrices[item.category.slug] || 500;
  const conditionMultiplier = conditionMultipliers[item.condition] || 1.0;

  // Demand factor based on total rentals
  const demandFactor = Math.min(1 + (item.totalRentals * 0.02), 1.5);

  const suggestedPrice = Math.round(basePrice * conditionMultiplier * demandFactor);
  const minPrice = Math.round(suggestedPrice * 0.8);
  const maxPrice = Math.round(suggestedPrice * 1.3);

  res.json({
    success: true,
    data: {
      suggestedPrice,
      minPrice,
      maxPrice,
      factors: {
        baseMarketPrice: basePrice,
        conditionMultiplier,
        demandFactor,
        category: item.category.name,
      },
    },
  });
});