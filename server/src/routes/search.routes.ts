// server/src/routes/search.routes.ts
import { Router } from 'express';
import { searchItems, getSearchSuggestions, getDemandHeatmap } from '../controllers/search.controller';
import { optionalAuth } from '../middlewares/auth';

const router = Router();
router.get('/', optionalAuth, searchItems);
router.get('/suggestions', getSearchSuggestions);
router.get('/heatmap', getDemandHeatmap);
export default router;