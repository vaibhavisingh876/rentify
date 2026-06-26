// server/src/routes/user.routes.ts
import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  getUserStats,
  getUserReviews,
  getUserTrustScore,
  updateLocation,
  deactivateAccount,
  getPublicProfile,
} from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth';
import { uploadSingle } from '../config/cloudinary';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/avatar', authenticate, uploadSingle, uploadAvatar);
router.delete('/avatar', authenticate, deleteAvatar);
router.get('/stats', authenticate, getUserStats);
router.get('/reviews', authenticate, getUserReviews);
router.get('/trust-score', authenticate, getUserTrustScore);
router.put('/location', authenticate, updateLocation);
router.post('/deactivate', authenticate, deactivateAccount);
router.get('/:username', getPublicProfile);

export default router;