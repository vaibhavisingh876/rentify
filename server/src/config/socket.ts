import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from './env';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../utils/auth';
import { prisma } from './database';

let io: SocketIOServer;

export const initSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Auth middleware ──────────────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyAccessToken(token);
      if (!payload) return next(new Error('Invalid token'));

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
      });

      if (!user) return next(new Error('User not found'));

      (socket as any).user = user;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  // ─── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.debug(`Socket connected: ${user.id} (${socket.id})`);

    // Join personal room for notifications
    socket.join(`user:${user.id}`);

    // Update last seen
    prisma.user
      .update({ where: { id: user.id }, data: { lastSeen: new Date() } })
      .catch(() => {});

    // ── Chat rooms ────────────────────────────────────────────────────────
    socket.on('join_chat', async (chatId: string) => {
      const participant = await prisma.chatParticipant
        .findUnique({ where: { chatId_userId: { chatId, userId: user.id } } })
        .catch(() => null);

      if (participant) {
        socket.join(`chat:${chatId}`);
        logger.debug(`User ${user.id} joined chat ${chatId}`);
      }
    });

    socket.on('leave_chat', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
    });

    // ── Typing indicators ─────────────────────────────────────────────────
    socket.on('typing_start', ({ chatId }: { chatId: string }) => {
      socket.to(`chat:${chatId}`).emit('user_typing', { userId: user.id, chatId });
    });

    socket.on('typing_stop', ({ chatId }: { chatId: string }) => {
      socket.to(`chat:${chatId}`).emit('user_stopped_typing', { userId: user.id, chatId });
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${user.id} (${socket.id})`);
      prisma.user
        .update({ where: { id: user.id }, data: { lastSeen: new Date() } })
        .catch(() => {});
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket() first.');
  return io;
};

export const emitToUser = (userId: string, event: string, data: unknown): void => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};