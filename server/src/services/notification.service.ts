import { NotificationType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { emitToUser } from '../config/socket';
import { CreateNotificationPayload } from '../types';

/**
 * Create a notification record in DB and emit it via socket to the target user.
 */
export const createNotification = async (
  payload: CreateNotificationPayload,
): Promise<void> => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data ?? null,
      },
    });

    // Emit real-time notification via Socket.io
    emitToUser(payload.userId, 'new_notification', notification);
  } catch (error) {
    logger.error('Failed to create notification:', error);
    // Non-blocking: don't throw, let the calling code continue
  }
};

/**
 * Mark all unread notifications for a user as read.
 */
export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

/**
 * Get unread notification count for a user.
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({ where: { userId, isRead: false } });
};

/**
 * Create bulk notifications (e.g., system announcements).
 */
export const createBulkNotifications = async (
  userIds: string[],
  payload: Omit<CreateNotificationPayload, 'userId'>,
): Promise<void> => {
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data ?? null,
      })),
    });

    // Emit to all users
    userIds.forEach((userId) => {
      emitToUser(userId, 'new_notification', {
        type: payload.type,
        title: payload.title,
        message: payload.message,
      });
    });
  } catch (error) {
    logger.error('Failed to create bulk notifications:', error);
  }
};

/**
 * Predefined notification builders for common events.
 */
export const notifications = {
  bookingRequest: (ownerId: string, renterName: string, itemTitle: string, bookingId: string) =>
    createNotification({
      userId: ownerId,
      type: NotificationType.BOOKING_REQUEST,
      title: 'New Booking Request',
      message: `${renterName} wants to rent your ${itemTitle}`,
      data: { bookingId },
    }),

  bookingConfirmed: (renterId: string, itemTitle: string, bookingId: string) =>
    createNotification({
      userId: renterId,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Booking Confirmed!',
      message: `Your booking for ${itemTitle} has been confirmed`,
      data: { bookingId },
    }),

  bookingCancelled: (userId: string, itemTitle: string, bookingId: string, cancelledBy: string) =>
    createNotification({
      userId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Booking Cancelled',
      message: `The booking for ${itemTitle} has been cancelled by ${cancelledBy}`,
      data: { bookingId },
    }),

  paymentSuccess: (userId: string, amount: number, itemTitle: string, bookingId: string) =>
    createNotification({
      userId,
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Payment Received',
      message: `Payment of ₹${amount.toLocaleString('en-IN')} received for ${itemTitle}`,
      data: { bookingId },
    }),

  paymentFailed: (userId: string, amount: number, bookingId: string) =>
    createNotification({
      userId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment Failed',
      message: `Payment of ₹${amount.toLocaleString('en-IN')} could not be processed`,
      data: { bookingId },
    }),

  reviewReceived: (userId: string, reviewerName: string, rating: number) =>
    createNotification({
      userId,
      type: NotificationType.REVIEW_RECEIVED,
      title: 'New Review',
      message: `${reviewerName} gave you a ${rating}-star review`,
      data: { rating },
    }),

  itemReturned: (lenderId: string, itemTitle: string, bookingId: string) =>
    createNotification({
      userId: lenderId,
      type: NotificationType.ITEM_RETURNED,
      title: 'Item Returned',
      message: `${itemTitle} has been returned successfully`,
      data: { bookingId },
    }),

  damageReported: (ownerId: string, itemTitle: string, reportId: string) =>
    createNotification({
      userId: ownerId,
      type: NotificationType.DAMAGE_REPORTED,
      title: 'Damage Reported',
      message: `A damage has been reported for your item: ${itemTitle}`,
      data: { reportId },
    }),

  trustScoreUpdate: (userId: string, newScore: number, change: number) =>
    createNotification({
      userId,
      type: NotificationType.TRUST_SCORE_UPDATE,
      title: 'Trust Score Updated',
      message: `Your trust score ${change >= 0 ? 'increased' : 'decreased'} by ${Math.abs(change)} points. New score: ${newScore}`,
      data: { newScore, change },
    }),
};