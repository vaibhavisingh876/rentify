// server/src/routes/review.routes.ts
import { Router } from 'express';
import {
  createReview,
  getItemReviews,
  getUserReviews,
  getReview,
  deleteReview,
} from '../controllers/review.controller';
import { authenticate, optionalAuth } from '../middlewares/auth';

const router = Router();

router.post('/', authenticate, createReview);
router.get('/item/:itemId', optionalAuth, getItemReviews);
router.get('/user/:userId', optionalAuth, getUserReviews);
router.get('/:id', optionalAuth, getReview);
router.delete('/:id', authenticate, deleteReview);

export default router;