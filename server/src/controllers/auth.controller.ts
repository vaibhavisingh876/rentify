// server/src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateEmailToken,
} from '../utils/auth';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { generateOTP } from '../utils/otp';
import { TrustBadge } from '@prisma/client';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, username, phone } = req.body;

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existingUser) {
    if (existingUser.email === email) throw new AppError('Email already registered', 409);
    throw new AppError('Username already taken', 409);
  }

  const passwordHash = await hashPassword(password);
  const emailToken = generateEmailToken();

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      username,
      phone: phone || null,
      trustScore: {
        create: {
          score: 50,
          badge: TrustBadge.BRONZE,
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      username: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });

  // Store email verification token in OTP table
  await prisma.oTP.create({
    data: {
      userId: user.id,
      code: emailToken,
      type: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // Send emails (non-blocking)
  sendVerificationEmail(email, firstName, emailToken).catch(console.error);
  sendWelcomeEmail(email, firstName).catch(console.error);

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshTokenValue = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', refreshTokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    success: true,
    message: 'Account created. Please verify your email.',
    data: { user, accessToken },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { trustScore: true },
  });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.isBanned) {
    throw new AppError(`Account banned: ${user.banReason || 'Violation of terms'}`, 403);
  }

  if (!user.isActive) {
    throw new AppError('Account deactivated. Contact support.', 403);
  }

  // Update last seen
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeen: new Date() },
  });

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshTokenValue = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', refreshTokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const { passwordHash, ...userWithoutPassword } = user;

  res.json({
    success: true,
    message: 'Login successful',
    data: { user: userWithoutPassword, accessToken },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshTokenValue = req.cookies.refreshToken;

  if (refreshTokenValue) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshTokenValue },
      data: { isRevoked: true },
    });
  }

  res.clearCookie('refreshToken');

  res.json({ success: true, message: 'Logged out successfully' });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const tokenValue = req.cookies.refreshToken || req.body.refreshToken;

  if (!tokenValue) throw new AppError('Refresh token required', 401);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: tokenValue },
    include: { user: true },
  });

  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const accessToken = generateAccessToken(storedToken.user.id, storedToken.user.role);

  // Rotate refresh token
  const newRefreshToken = generateRefreshToken();
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { isRevoked: true },
  });
  await prisma.refreshToken.create({
    data: {
      userId: storedToken.user.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, data: { accessToken } });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  const resetToken = generateEmailToken();

  await prisma.oTP.create({
    data: {
      userId: user.id,
      code: resetToken,
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  await sendPasswordResetEmail(email, user.firstName, resetToken);

  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const otpRecord = await prisma.oTP.findFirst({
    where: {
      code: token,
      type: 'PASSWORD_RESET',
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!otpRecord) throw new AppError('Invalid or expired reset token', 400);

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: otpRecord.userId },
    data: { passwordHash },
  });

  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId: otpRecord.userId },
    data: { isRevoked: true },
  });

  res.json({ success: true, message: 'Password reset successful. Please login.' });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  const otpRecord = await prisma.oTP.findFirst({
    where: {
      code: token,
      type: 'EMAIL_VERIFY',
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otpRecord) throw new AppError('Invalid or expired verification token', 400);

  await prisma.user.update({
    where: { id: otpRecord.userId },
    data: { isEmailVerified: true },
  });

  await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } });

  // Update trust score
  await prisma.userTrustScore.update({
    where: { userId: otpRecord.userId },
    data: { isEmailVerified: true, score: { increment: 10 } },
  });

  res.json({ success: true, message: 'Email verified successfully' });
});

export const sendEmailVerification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new AppError('User not found', 404);
  if (user.isEmailVerified) throw new AppError('Email already verified', 400);

  const emailToken = generateEmailToken();

  await prisma.oTP.create({
    data: {
      userId,
      code: emailToken,
      type: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail(user.email, user.firstName, emailToken);

  res.json({ success: true, message: 'Verification email sent' });
});

export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { phone } = req.body;

  const otp = generateOTP();

  await prisma.oTP.create({
    data: {
      userId,
      code: otp,
      type: 'PHONE_VERIFY',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  // In production, send via SMS gateway (Twilio/MSG91)
  console.log(`OTP for ${phone}: ${otp}`);

  res.json({ success: true, message: 'OTP sent to your phone' });
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { otp, phone } = req.body;

  const otpRecord = await prisma.oTP.findFirst({
    where: {
      userId,
      code: otp,
      type: 'PHONE_VERIFY',
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otpRecord) throw new AppError('Invalid or expired OTP', 400);

  await prisma.user.update({
    where: { id: userId },
    data: { phone, isPhoneVerified: true },
  });

  await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } });

  await prisma.userTrustScore.update({
    where: { userId },
    data: { isPhoneVerified: true, score: { increment: 10 } },
  });

  res.json({ success: true, message: 'Phone verified successfully' });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      trustScore: true,
      _count: {
        select: {
          items: true,
          bookingsAsRenter: true,
          bookingsAsLender: true,
          reviewsReceived: true,
        },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  const { passwordHash, ...userWithoutPassword } = user;

  res.json({ success: true, data: userWithoutPassword });
});