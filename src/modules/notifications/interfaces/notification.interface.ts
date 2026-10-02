import { NotificationRole, NotificationType } from '@prisma/client';

export interface NotificationResponse {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  targetRole: NotificationRole;
  createdAt: Date;
}

export interface NotificationsFeed {
  unread: NotificationResponse[];
  recent: NotificationResponse[];
}

export interface CreateNotificationData {
  title: string;
  message: string;
  type: NotificationType;
  targetRole?: NotificationRole;
}
