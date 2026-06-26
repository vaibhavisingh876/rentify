// server/src/routes/admin.routes.ts
import { Router } from 'express';
import {
  getDashboardStats,
  getUsers,
  getUserDetail,
  banUser,
  unbanUser,
  getItems,
  removeItem,
  featureItem,
  getBookings,
  getPayments,
  getReviews,
  deleteReview,
  getDamageReports,
  resolveDamageReport,
  getAnalytics,
  getRentalRequests,
} from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.post('/users/:id/ban', banUser);
router.post('/users/:id/unban', unbanUser);
router.get('/items', getItems);
router.delete('/items/:id', removeItem);
router.patch('/items/:id/feature', featureItem);
router.get('/bookings', getBookings);
router.get('/payments', getPayments);
router.get('/reviews', getReviews);
router.delete('/reviews/:id', deleteReview);
router.get('/damage-reports', getDamageReports);
router.patch('/damage-reports/:id/resolve', resolveDamageReport);
router.get('/rental-requests', getRentalRequests);

export default router;