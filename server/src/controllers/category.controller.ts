// server/src/controllers/category.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    include: { children: { where: { isActive: true } }, _count: { select: { items: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ success: true, data: categories });
});

export const getCategoryStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { items: { where: { isActive: true } } } },
    },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ success: true, data: stats });
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    include: { children: true, _count: { select: { items: true } } },
  });
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, data: category });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, iconUrl, color, parentId, sortOrder } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const category = await prisma.category.create({
    data: { name, slug, description, iconUrl, color, parentId, sortOrder: sortOrder || 0 },
  });
  res.status(201).json({ success: true, data: category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: category });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true, message: 'Category deactivated' });
});