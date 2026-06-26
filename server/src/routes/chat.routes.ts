// server/src/routes/chat.routes.ts
import { Router } from 'express';
import {
  getChats,
  getChat,
  createChat,
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
} from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth';
import { uploadSingle } from '../config/cloudinary';

const router = Router();

router.get('/', authenticate, getChats);
router.post('/', authenticate, createChat);
router.get('/:chatId', authenticate, getChat);
router.get('/:chatId/messages', authenticate, getMessages);
router.post('/:chatId/messages', authenticate, uploadSingle, sendMessage);
router.patch('/:chatId/read', authenticate, markAsRead);
router.delete('/:chatId/messages/:messageId', authenticate, deleteMessage);

export default router;