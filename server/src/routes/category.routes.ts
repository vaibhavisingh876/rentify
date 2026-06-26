// server/src/routes/category.routes.ts
import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
} from '../controllers/category.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();
router.get('/', getCategories);
router.get('/stats', getCategoryStats);
router.get('/:slug', getCategory);
router.post('/', authenticate, requireAdmin, createCategory);
router.put('/:id', authenticate, requireAdmin, updateCategory);
router.delete('/:id', authenticate, requireAdmin, deleteCategory);
export default router;