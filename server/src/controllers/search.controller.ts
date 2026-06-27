import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { ItemCondition, DeliveryOption } from '@prisma/client';

export const searchItems = asyncHandler(async (req: Request, res: Response) => {
  const {
    q,
    page = '1',
    limit = '12',
    category,
    minPrice,
    maxPrice,
    condition,
    deliveryOption,
    instantBooking,
    city,
    lat,
    lng,
    radius = '10',
    sort = 'newest',
    tags,
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 50);
  const skip = (pageNum - 1) * limitNum;

  const where: any = { isActive: true, isAvailable: true };

  // Full-text search across title, description, tags
  if (q) {
    const query = (q as string).trim();
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { tags: { has: query } },
      { city: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (category) where.category = { slug: category as string };

  if (minPrice || maxPrice) {
    where.pricePerDay = {};
    if (minPrice) where.pricePerDay.gte = parseFloat(minPrice as string);
    if (maxPrice) where.pricePerDay.lte = parseFloat(maxPrice as string);
  }

  if (condition && Object.values(ItemCondition).includes(condition as ItemCondition)) {
    where.condition = condition as ItemCondition;
  }

  if (
    deliveryOption &&
    Object.values(DeliveryOption).includes(deliveryOption as DeliveryOption)
  ) {
    where.deliveryOption = deliveryOption as DeliveryOption;
  }

  if (instantBooking === 'true') where.instantBooking = true;

  if (city) where.city = { contains: city as string, mode: 'insensitive' };

  // Geo bounding box filter
  if (lat && lng) {
    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    const radiusNum = parseFloat(radius as string);
    const latDiff = radiusNum / 111;
    const lngDiff = radiusNum / (111 * Math.cos((latNum * Math.PI) / 180));
    where.latitude = { gte: latNum - latDiff, lte: latNum + latDiff };
    where.longitude = { gte: lngNum - lngDiff, lte: lngNum + lngDiff };
  }

  // Tags filter
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : [tags as string];
    where.tags = { hasSome: tagList };
  }

  const orderBy: any = {};
  switch (sort as string) {
    case 'price_asc':  orderBy.pricePerDay   = 'asc';  break;
    case 'price_desc': orderBy.pricePerDay   = 'desc'; break;
    case 'rating':     orderBy.averageRating = 'desc'; break;
    case 'popular':    orderBy.totalRentals  = 'desc'; break;
    case 'views':      orderBy.viewCount     = 'desc'; break;
    case 'newest':
    default:           orderBy.createdAt     = 'desc'; break;
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
            trustScore: true,
          },
        },
        _count: { select: { reviews: true, bookings: true } },
      },
    }),
    prisma.item.count({ where }),
  ]);

  // Attach distance if geo coords provided
  let results: any[] = items;
  if (lat && lng) {
    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    results = items
      .map((item) => {
        if (!item.latitude || !item.longitude) return { ...item, distance: null };
        const R = 6371;
        const dLat = ((item.latitude - latNum) * Math.PI) / 180;
        const dLng = ((item.longitude - lngNum) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((latNum * Math.PI) / 180) *
            Math.cos((item.latitude * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...item, distance: Math.round(distance * 10) / 10 };
      });
  }

  res.json({
    success: true,
    data: {
      items: results,
      query: q || null,
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

export const getSearchSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || (q as string).trim().length < 2) {
    return res.json({ success: true, data: { suggestions: [] } });
  }

  const query = (q as string).trim();

  // Fetch matching item titles, categories, and cities in parallel
  const [itemTitles, categories, cities] = await Promise.all([
    prisma.item.findMany({
      where: {
        isActive: true,
        isAvailable: true,
        title: { contains: query, mode: 'insensitive' },
      },
      select: { title: true, slug: true },
      take: 5,
      orderBy: { viewCount: 'desc' },
    }),
    prisma.category.findMany({
      where: {
        isActive: true,
        name: { contains: query, mode: 'insensitive' },
      },
      select: { name: true, slug: true },
      take: 3,
    }),
    prisma.item.findMany({
      where: {
        isActive: true,
        isAvailable: true,
        city: { contains: query, mode: 'insensitive' },
      },
      select: { city: true },
      distinct: ['city'],
      take: 3,
    }),
  ]);

  const suggestions = [
    ...itemTitles.map((i) => ({ type: 'item', label: i.title, slug: i.slug })),
    ...categories.map((c) => ({ type: 'category', label: c.name, slug: c.slug })),
    ...cities
      .filter((c) => c.city)
      .map((c) => ({ type: 'city', label: c.city as string, slug: null })),
  ];

  res.json({ success: true, data: { suggestions } });
});

export const getDemandHeatmap = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;

  const where: any = {
    isActive: true,
    latitude: { not: null },
    longitude: { not: null },
  };

  if (category) where.category = { slug: category as string };

  // Return items with coordinates and their booking/view count as "heat" weight
  const items = await prisma.item.findMany({
    where,
    select: {
      latitude: true,
      longitude: true,
      city: true,
      totalRentals: true,
      viewCount: true,
      _count: { select: { bookings: true } },
    },
    take: 500,
  });

  const heatmapPoints = items
    .filter((item) => item.latitude && item.longitude)
    .map((item) => ({
      lat: item.latitude!,
      lng: item.longitude!,
      city: item.city,
      weight: item.totalRentals + item.viewCount * 0.1,
    }));

  // Group by city for a summary view
  const citySummary = await prisma.item.groupBy({
    by: ['city'],
    where: { isActive: true, city: { not: null } },
    _count: { id: true },
    _avg: { pricePerDay: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  res.json({
    success: true,
    data: {
      heatmapPoints,
      citySummary,
    },
  });
});