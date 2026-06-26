import { z } from 'zod';
import { validate } from '../middlewares/validate';

export const createChatSchema = z.object({
  recipientId: z
    .string({ required_error: 'Recipient ID is required' })
    .cuid('Invalid recipient ID'),
  bookingId: z.string().cuid('Invalid booking ID').optional(),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long')
    .trim()
    .optional(),
});

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const chatParamsSchema = z.object({
  chatId: z.string({ required_error: 'Chat ID is required' }).cuid('Invalid chat ID'),
});

export const messageParamsSchema = z.object({
  chatId: z.string({ required_error: 'Chat ID is required' }).cuid('Invalid chat ID'),
  messageId: z.string({ required_error: 'Message ID is required' }).cuid('Invalid message ID'),
});

// ─── Middleware exports ───────────────────────────────────────────────────────
export const validateCreateChat = validate(createChatSchema);
export const validateSendMessage = validate(sendMessageSchema);
export const validateMessageQuery = validate(messageQuerySchema, 'query');