import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: env.isProduction },
});

// ─── Base template ────────────────────────────────────────────────────────────
const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rentify</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
    .body { padding: 40px; color: #374151; line-height: 1.7; }
    .body h2 { color: #111827; font-size: 22px; margin: 0 0 16px; }
    .body p { margin: 0 0 16px; font-size: 15px; }
    .btn { display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
    .code { background: #f0fdf4; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #059669; margin: 24px 0; font-family: monospace; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #92400e; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏠 Rentify</h1>
      <p>India's Peer-to-Peer Rental Marketplace</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Rentify Technologies Pvt. Ltd. | Bangalore, Karnataka</p>
      <p style="margin-top:8px;">If you didn't request this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
`;

const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<void> => {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
    logger.debug(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
};

// ─── Email senders ────────────────────────────────────────────────────────────
export const sendVerificationEmail = async (
  email: string,
  firstName: string,
  token: string,
): Promise<void> => {
  const verifyUrl = `${env.CLIENT_URL}/verify-email/${token}`;

  const content = `
    <h2>Hello, ${firstName}! 👋</h2>
    <p>Welcome to Rentify! Please verify your email address to activate your account and start renting or lending items.</p>
    <p style="text-align:center;">
      <a href="${verifyUrl}" class="btn">✓ Verify Email Address</a>
    </p>
    <div class="warning">
      This link expires in <strong>24 hours</strong>. After that, you'll need to request a new verification email.
    </div>
    <hr class="divider" />
    <p style="font-size:13px;color:#6b7280;">Or paste this link in your browser:<br/><span style="color:#10b981;word-break:break-all;">${verifyUrl}</span></p>
  `;

  await sendEmail(email, '✓ Verify Your Rentify Email', baseTemplate(content));
};

export const sendWelcomeEmail = async (
  email: string,
  firstName: string,
): Promise<void> => {
  const content = `
    <h2>Welcome to Rentify, ${firstName}! 🎉</h2>
    <p>Your account has been created successfully. Here's what you can do next:</p>
    <ul style="padding-left:20px;margin:16px 0;">
      <li style="margin-bottom:8px;">🔍 <strong>Browse items</strong> available near you</li>
      <li style="margin-bottom:8px;">📦 <strong>List your items</strong> and start earning</li>
      <li style="margin-bottom:8px;">⭐ <strong>Build your trust score</strong> by completing rentals</li>
      <li style="margin-bottom:8px;">💬 <strong>Chat directly</strong> with lenders and renters</li>
    </ul>
    <p style="text-align:center;">
      <a href="${env.CLIENT_URL}" class="btn">Start Exploring →</a>
    </p>
    <p>If you have any questions, reply to this email and our support team will help you!</p>
  `;

  await sendEmail(email, '🎉 Welcome to Rentify – Your Rental Marketplace!', baseTemplate(content));
};

export const sendPasswordResetEmail = async (
  email: string,
  firstName: string,
  token: string,
): Promise<void> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

  const content = `
    <h2>Reset Your Password</h2>
    <p>Hi ${firstName},</p>
    <p>We received a request to reset your Rentify account password. Click the button below to set a new password:</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" class="btn">🔒 Reset Password</a>
    </p>
    <div class="warning">
      This link expires in <strong>1 hour</strong>. If you didn't request a password reset, please ignore this email — your password won't change.
    </div>
    <hr class="divider" />
    <p style="font-size:13px;color:#6b7280;">Or paste this link in your browser:<br/><span style="color:#10b981;word-break:break-all;">${resetUrl}</span></p>
  `;

  await sendEmail(email, '🔒 Reset Your Rentify Password', baseTemplate(content));
};

export const sendBookingConfirmationEmail = async (
  email: string,
  firstName: string,
  bookingDetails: {
    itemTitle: string;
    startDate: Date;
    endDate: Date;
    totalAmount: number;
    bookingId: string;
  },
): Promise<void> => {
  const { itemTitle, startDate, endDate, totalAmount, bookingId } = bookingDetails;
  const bookingUrl = `${env.CLIENT_URL}/bookings/${bookingId}`;

  const content = `
    <h2>Booking Confirmed! 🎊</h2>
    <p>Hi ${firstName},</p>
    <p>Great news! Your booking has been confirmed. Here are the details:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr style="background:#f0fdf4;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-radius:4px 0 0 4px;">Item</td><td style="padding:10px 14px;">${itemTitle}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#374151;">Start Date</td><td style="padding:10px 14px;">${startDate.toLocaleDateString('en-IN', { dateStyle: 'full' })}</td></tr>
      <tr style="background:#f0fdf4;"><td style="padding:10px 14px;font-weight:600;color:#374151;">End Date</td><td style="padding:10px 14px;">${endDate.toLocaleDateString('en-IN', { dateStyle: 'full' })}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#374151;">Total Amount</td><td style="padding:10px 14px;font-size:18px;font-weight:700;color:#059669;">₹${totalAmount.toLocaleString('en-IN')}</td></tr>
    </table>
    <p style="text-align:center;">
      <a href="${bookingUrl}" class="btn">View Booking →</a>
    </p>
  `;

  await sendEmail(email, `✅ Booking Confirmed – ${itemTitle}`, baseTemplate(content));
};

export const sendOTPEmail = async (
  email: string,
  firstName: string,
  otp: string,
): Promise<void> => {
  const content = `
    <h2>Your OTP Code</h2>
    <p>Hi ${firstName},</p>
    <p>Use the following OTP to verify your action:</p>
    <div class="code">${otp}</div>
    <div class="warning">
      This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.
    </div>
  `;

  await sendEmail(email, '🔐 Your Rentify OTP Code', baseTemplate(content));
};