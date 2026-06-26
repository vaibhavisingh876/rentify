// server/src/routes/item.routes.ts
import { Router } from 'express';
import {
  createItem,
  getItems,
  getItem,
  updateItem,
  deleteItem,
  getUserItems,
  toggleWishlist,
  getItemAvailability,
  updateItemAvailability,
  getNearbyItems,
  getTrendingItems,
  getFeaturedItems,
  getAISuggestedPrice,
} from '../controllers/item.controller';
import { authenticate, optionalAuth } from '../middlewares/auth';
import { uploadImages } from '../config/cloudinary';

const router = Router();

router.get('/', optionalAuth, getItems);
router.get('/nearby', optionalAuth, getNearbyItems);
router.get('/trending', getTrendingItems);
router.get('/featured', getFeaturedItems);
router.get('/user/:userId', optionalAuth, getUserItems);
router.get('/:id', optionalAuth, getItem);
router.get('/:id/availability', getItemAvailability);
router.post('/', authenticate, uploadImages, createItem);
router.put('/:id', authenticate, uploadImages, updateItem);
router.delete('/:id', authenticate, deleteItem);
router.post('/:id/availability', authenticate, updateItemAvailability);
router.get('/:id/ai-price', authenticate, getAISuggestedPrice);

export default router;