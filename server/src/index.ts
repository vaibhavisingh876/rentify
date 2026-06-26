// server/src/index.ts
import 'dotenv/config';
import http from 'http';
import { app } from './app';
import { initializeSocket } from './config/socket';
import { logger } from './utils/logger';
import { connectRedis } from './config/redis';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Start server
const startServer = async () => {
  try {
    // Connect Redis if available
    await connectRedis();

    server.listen(PORT, () => {
      logger.info(`🚀 Rentify server running on port ${PORT}`);
      logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();