import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/auth';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/database';

/**
 * Extracts the Bearer token from the Authorization header or cookies.
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

/**
 * authenticate – requires a valid access token. Attaches req.user.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError('Access token required', 401);

    const payload = verifyAccessToken(token);
    if (!payload) throw new AppError('Invalid or expired access token', 401);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        isBanned: true,
        banReason: true,
      },
    });

    if (!user) throw new AppError('User no longer exists', 401);
    if (!user.isActive) throw new AppError('Account deactivated', 403);
    if (user.isBanned)
      throw new AppError(`Account banned: ${user.banReason || 'Terms violation'}`, 403);

    req.user = {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * optionalAuth – attaches req.user if a valid token is present, otherwise continues.
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const payload = verifyAccessToken(token);
    if (!payload) return next();

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (user && user.isActive && !user.isBanned) {
      req.user = {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      };
    }

    next();
  } catch {
    // Silently continue without user if token is invalid
    next();
  }
};

/**
 * requireRole – restricts access to specific roles. Must come after authenticate.
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access restricted to: ${roles.join(', ')}. Your role: ${req.user.role}`,
          403,
        ),
      );
    }
    next();
  };
};

/**
 * requireAdmin – shorthand for requireRole('ADMIN').
 */
export const requireAdmin = requireRole(Role.ADMIN);

/**
 * requireEmailVerified – ensures user's email is verified.
 */
export const requireEmailVerified = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) return next(new AppError('Authentication required', 401));

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isEmailVerified: true },
    });

    if (!user?.isEmailVerified) {
      return next(new AppError('Email verification required', 403));
    }

    next();
  } catch (error) {
    next(error);
  }
};