// server/src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import itemRoutes from './item.routes';
import bookingRoutes from './booking.routes';
import paymentRoutes from './payment.routes';
import reviewRoutes from './review.routes';
import chatRoutes from './chat.routes';
import notificationRoutes from './notification.routes';
import wishlistRoutes from './wishlist.routes';
import categoryRoutes from './category.routes';
import rentalRequestRoutes from './rentalRequest.routes';
import adminRoutes from './admin.routes';
import uploadRoutes from './upload.routes';
import searchRoutes from './search.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/items', itemRoutes);
apiRouter.use('/bookings', bookingRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/chats', chatRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/wishlist', wishlistRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/rental-requests', rentalRequestRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/search', searchRoutes);