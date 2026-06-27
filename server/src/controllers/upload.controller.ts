import { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { deleteFromCloudinary } from '../config/cloudinary';

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as any;

  if (!file) throw new AppError('No file uploaded', 400);

  res.status(201).json({
    success: true,
    message: 'Image uploaded successfully',
    data: {
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    },
  });
});

export const uploadMultipleImages = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as any[];

  if (!files || files.length === 0) throw new AppError('No files uploaded', 400);

  const uploaded = files.map((file: any) => ({
    url: file.path,
    publicId: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  }));

  res.status(201).json({
    success: true,
    message: `${uploaded.length} image(s) uploaded successfully`,
    data: uploaded,
  });
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const { publicId } = req.params;

  if (!publicId) throw new AppError('Public ID is required', 400);

  // Decode URI component in case it was encoded (e.g. folder/filename)
  const decodedPublicId = decodeURIComponent(publicId);

  await deleteFromCloudinary(decodedPublicId);

  res.json({ success: true, message: 'Image deleted successfully' });
});