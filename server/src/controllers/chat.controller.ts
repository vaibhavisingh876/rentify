// server/src/controllers/chat.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { getIO } from '../config/socket';

export const getChats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const chats = await prisma.chat.findMany({
    where: {
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, lastSeen: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, firstName: true } } },
      },
      booking: {
        include: { item: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Add unread count for each chat
  const chatsWithUnread = await Promise.all(
    chats.map(async (chat) => {
      const participant = chat.participants.find(p => p.userId === userId);
      const unreadCount = await prisma.message.count({
        where: {
          chatId: chat.id,
          senderId: { not: userId },
          isRead: false,
          createdAt: { gt: participant?.lastReadAt || new Date(0) },
        },
      });
      return { ...chat, unreadCount };
    })
  );

  res.json({ success: true, data: chatsWithUnread });
});

export const getChat = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user!.id;

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      participants: {
        include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, lastSeen: true } } },
      },
      booking: {
        include: { item: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
      },
    },
  });

  if (!chat) throw new AppError('Chat not found', 404);

  const isParticipant = chat.participants.some(p => p.userId === userId);
  if (!isParticipant) throw new AppError('Unauthorized', 403);

  res.json({ success: true, data: chat });
});

export const createChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { recipientId, bookingId } = req.body;

  if (recipientId === userId) throw new AppError('Cannot chat with yourself', 400);

  // Check if chat already exists between these users
  const existingChat = await prisma.chat.findFirst({
    where: {
      bookingId: bookingId || null,
      participants: {
        every: { userId: { in: [userId, recipientId] } },
      },
    },
    include: { participants: true },
  });

  if (existingChat && existingChat.participants.length === 2) {
    return res.json({ success: true, data: existingChat });
  }

  const chat = await prisma.chat.create({
    data: {
      bookingId: bookingId || null,
      participants: {
        create: [{ userId }, { userId: recipientId }],
      },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      },
    },
  });

  res.status(201).json({ success: true, data: chat });
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user!.id;
  const { page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const isParticipant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!isParticipant) throw new AppError('Unauthorized', 403);

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { chatId, isDeleted: false },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.message.count({ where: { chatId, isDeleted: false } }),
  ]);

  res.json({
    success: true,
    data: {
      messages: messages.reverse(),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    },
  });
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const senderId = req.user!.id;
  const { content } = req.body;
  const file = req.file as any;

  const isParticipant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId: senderId } },
  });
  if (!isParticipant) throw new AppError('Unauthorized', 403);

  if (!content && !file) throw new AppError('Message content or image required', 400);

  const message = await prisma.message.create({
    data: {
      chatId,
      senderId,
      content: content || null,
      imageUrl: file?.path || null,
      imagePublicId: file?.filename || null,
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

  // Emit to socket
  const io = getIO();
  io.to(`chat:${chatId}`).emit('new_message', message);

  res.status(201).json({ success: true, data: message });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user!.id;

  await prisma.chatParticipant.update({
    where: { chatId_userId: { chatId, userId } },
    data: { lastReadAt: new Date() },
  });

  await prisma.message.updateMany({
    where: { chatId, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  });

  const io = getIO();
  io.to(`chat:${chatId}`).emit('messages_read', { chatId, userId });

  res.json({ success: true, message: 'Messages marked as read' });
});

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { chatId, messageId } = req.params;
  const userId = req.user!.id;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError('Message not found', 404);
  if (message.senderId !== userId) throw new AppError('Unauthorized', 403);
  if (message.chatId !== chatId) throw new AppError('Message not in this chat', 400);

  await prisma.message.update({ where: { id: messageId }, data: { isDeleted: true, content: null } });

  const io = getIO();
  io.to(`chat:${chatId}`).emit('message_deleted', { messageId, chatId });

  res.json({ success: true, message: 'Message deleted' });
});