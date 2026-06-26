import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { Role } from '@prisma/client';

const SALT_ROUNDS = 12;

// ─── Password ─────────────────────────────────────────────────────────────────
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  plainText: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(plainText, hash);
};

// ─── JWT ──────────────────────────────────────────────────────────────────────
export interface JWTPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export const generateAccessToken = (userId: string, role: Role): string => {
  return jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'rentify',
    audience: 'rentify-client',
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'rentify',
      audience: 'rentify-client',
    }) as JWTPayload;
  } catch {
    return null;
  }
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const verifyRefreshToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'rentify',
    }) as JWTPayload;
  } catch {
    return null;
  }
};

// ─── Email / reset tokens ─────────────────────────────────────────────────────
export const generateEmailToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};