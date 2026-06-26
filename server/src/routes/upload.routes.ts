// server/src/routes/upload.routes.ts
import { Router } from 'express';
import { uploadImage, deleteImage, uploadMultipleImages } from '../controllers/upload.controller';
import { authenticate } from '../middlewares/auth';
import { uploadImages, uploadSingle } from '../config/cloudinary';

const router = Router();
router.post('/single', authenticate, uploadSingle, uploadImage);
router.post('/multiple', authenticate, uploadImages, uploadMultipleImages);
router.delete('/:publicId', authenticate, deleteImage);
export default router;