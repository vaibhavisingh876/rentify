import rateLimit from 'express-rate-limit';

const jsonHandler = (_req: any, _res: any, next: any, options: any) => {
  next(Object.assign(new Error(options.message?.message || 'Too many requests'), { statusCode: 429 }));
};

/**
 * Strict limiter for auth endpoints (login, register, password reset).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  message: { success: false, message: 'Too many auth attempts. Please try again in 15 minutes.' },
});

/**
 * OTP / email send limiter.
 */
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  message: { success: false, message: 'Too many OTP requests. Please wait 10 minutes.' },
});

/**
 * General API limiter (applied globally).
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

/**
 * Upload limiter – prevent abuse of Cloudinary bandwidth.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  message: { success: false, message: 'Upload limit reached. Please try again in an hour.' },
});

/**
 * Search limiter – prevent abuse of search endpoint.
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  message: { success: false, message: 'Too many search requests. Please slow down.' },
});

/**
 * Payment limiter – conservative to prevent fraud.
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  message: { success: false, message: 'Payment request limit reached. Please try again later.' },
});