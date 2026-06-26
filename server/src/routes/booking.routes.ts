// server/src/routes/booking.routes.ts
import { Router } from 'express';
import {
  createBooking,
  getBookings,
  getBooking,
  updateBookingStatus,
  cancelBooking,
  confirmPickup,
  confirmReturn,
  extendBooking,
  getUserBookings,
  getLenderBookings,
  generateQRCode,
} from '../controllers/booking.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, getUserBookings);
router.get('/lender', authenticate, getLenderBookings);
router.get('/:id', authenticate, getBooking);
router.post('/', authenticate, createBooking);
router.patch('/:id/status', authenticate, updateBookingStatus);
router.post('/:id/cancel', authenticate, cancelBooking);
router.post('/:id/confirm-pickup', authenticate, confirmPickup);
router.post('/:id/confirm-return', authenticate, confirmReturn);
router.post('/:id/extend', authenticate, extendBooking);
router.get('/:id/qr', authenticate, generateQRCode);

export default router;