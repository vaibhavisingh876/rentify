// server/src/routes/payment.routes.ts
import { Router } from 'express';
import {
  createOrder,
  verifyPayment,
  getPayments,
  getPayment,
  requestRefund,
  handleWebhook,
  getInvoice,
} from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/create-order', authenticate, createOrder);
router.post('/verify', authenticate, verifyPayment);
router.get('/', authenticate, getPayments);
router.get('/:id', authenticate, getPayment);
router.post('/:id/refund', authenticate, requestRefund);
router.get('/:id/invoice', authenticate, getInvoice);
router.post('/webhook', handleWebhook);

export default router;