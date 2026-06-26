import crypto from 'crypto';

/**
 * Generate a cryptographically secure numeric OTP.
 * @param length Number of digits (default 6)
 */
export const generateOTP = (length: number = 6): string => {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const range = max - min;

  // Generate random bytes and convert to a number within range
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0);
  const otp = min + (randomNum % range);

  return otp.toString().padStart(length, '0');
};

/**
 * Generate a 4-digit OTP
 */
export const generateShortOTP = (): string => generateOTP(4);

/**
 * Generate a 8-character alphanumeric token
 */
export const generateAlphanumericToken = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
};