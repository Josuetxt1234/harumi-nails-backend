import { NotificationRole, NotificationType } from '@prisma/client';

export interface NotificationResponse {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  targetRole: NotificationRole;
  targetUserId: string | null;
  createdAt: Date;
}

/** Role broadcasts (targetUserId null) plus rows addressed to this user. */
export interface NotificationAudience {
  userId: string;
  targetRoles: NotificationRole[];
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
  targetUserId?: string;
}
