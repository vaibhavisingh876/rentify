// server/src/routes/rentalRequest.routes.ts
import { Router } from 'express';
import {
  createRentalRequest,
  getRentalRequests,
  getRentalRequest,
  updateRentalRequest,
  deleteRentalRequest,
  getNearbyRentalRequests,
} from '../controllers/rentalRequest.controller';
import { authenticate, optionalAuth } from '../middlewares/auth';

const router = Router();
router.get('/', optionalAuth, getRentalRequests);
router.get('/nearby', optionalAuth, getNearbyRentalRequests);
router.get('/:id', optionalAuth, getRentalRequest);
router.post('/', authenticate, createRentalRequest);
router.put('/:id', authenticate, updateRentalRequest);
router.delete('/:id', authenticate, deleteRentalRequest);
export default router;