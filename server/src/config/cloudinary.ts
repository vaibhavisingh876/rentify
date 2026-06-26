import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { env } from './env';
import { AppError } from '../utils/AppError';
import { Request } from 'express';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ─── Item images storage ────────────────────────────────────────────────────
const itemStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Request, file: Express.Multer.File) => ({
    folder: 'rentify/items',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto:good' }],
    public_id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  }),
});

// ─── Avatar storage ─────────────────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Request, _file: Express.Multer.File) => ({
    folder: 'rentify/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good' }],
    public_id: `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  }),
});

// ─── Chat image storage ──────────────────────────────────────────────────────
const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Request, _file: Express.Multer.File) => ({
    folder: 'rentify/chats',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto:good' }],
    public_id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  }),
});

// ─── Damage report storage ───────────────────────────────────────────────────
const damageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Request, _file: Express.Multer.File) => ({
    folder: 'rentify/damage-reports',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto:good' }],
    public_id: `damage_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  }),
});

// ─── File filter ─────────────────────────────────────────────────────────────
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed (jpg, png, webp, gif)', 400));
  }
};

// ─── Multer instances ────────────────────────────────────────────────────────
export const uploadImages = multer({
  storage: itemStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 10 MB, max 10 files
}).array('images', 10);

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('avatar');

export const uploadSingle = multer({
  storage: chatStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

export const uploadDamageImages = multer({
  storage: damageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
}).array('images', 10);

// ─── Utilities ───────────────────────────────────────────────────────────────
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset: ${publicId}`, error);
  }
};

export const uploadToCloudinary = async (
  filePath: string,
  folder: string = 'rentify',
  options: Record<string, unknown> = {},
): Promise<{ url: string; publicId: string }> => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    ...options,
  });
  return { url: result.secure_url, publicId: result.public_id };
};

export { cloudinary };