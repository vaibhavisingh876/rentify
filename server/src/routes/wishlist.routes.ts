// server/src/routes/wishlist.routes.ts
import { Router } from 'express';
import { getWishlist, toggleWishlist, checkWishlist } from '../controllers/wishlist.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.get('/', authenticate, getWishlist);
router.post('/toggle/:itemId', authenticate, toggleWishlist);
router.get('/check/:itemId', authenticate, checkWishlist);
export default router;