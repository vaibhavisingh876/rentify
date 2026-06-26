// server/src/routes/auth.routes.ts
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendEmailVerification,
  sendOTP,
  verifyOTP,
  getMe,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} from '../validators/auth.validator';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/logout', authenticate, logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', authLimiter, validateForgotPassword, forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/send-verification', authenticate, sendEmailVerification);
router.post('/send-otp', authenticate, sendOTP);
router.post('/verify-otp', authenticate, verifyOTP);
router.get('/me', authenticate, getMe);

export default router;