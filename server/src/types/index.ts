import { Role, BookingStatus, PaymentStatus, PaymentType, NotificationType } from '@prisma/client';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthenticatedUser {
  id: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  email?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface CreateNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// ─── Booking ──────────────────────────────────────────────────────────────────
export type BookingStatusTransition = {
  from: BookingStatus;
  allowedTo: BookingStatus[];
};

// ─── Search ───────────────────────────────────────────────────────────────────
export interface SearchFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  deliveryOption?: string;
  instantBooking?: boolean;
  city?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popular';
  page?: number;
  limit?: number;
}

// ─── Upload ───────────────────────────────────────────────────────────────────
export interface UploadedFile {
  url: string;
  publicId: string;
  originalName: string;
  size: number;
  mimeType: string;
}

// ─── Socket events ────────────────────────────────────────────────────────────
export interface SocketUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: Role;
}

export type ServerToClientEvents = {
  new_message: (message: unknown) => void;
  message_deleted: (data: { messageId: string; chatId: string }) => void;
  messages_read: (data: { chatId: string; userId: string }) => void;
  user_typing: (data: { userId: string; chatId: string }) => void;
  user_stopped_typing: (data: { userId: string; chatId: string }) => void;
  new_notification: (notification: unknown) => void;
  booking_update: (booking: unknown) => void;
};

export type ClientToServerEvents = {
  join_chat: (chatId: string) => void;
  leave_chat: (chatId: string) => void;
  typing_start: (data: { chatId: string }) => void;
  typing_stop: (data: { chatId: string }) => void;
};