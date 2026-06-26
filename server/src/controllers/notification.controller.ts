// server/src/controllers/notification.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user!.id },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where: { userId: req.user!.id } }),
  ]);

  res.json({ success: true, data: { notifications, pagination: { page: pageNum, limit: limitNum, total } } });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
  res.json({ success: true, data: { count } });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  res.json({ success: true });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
  res.json({ success: true, message: 'All notifications marked as read' });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});