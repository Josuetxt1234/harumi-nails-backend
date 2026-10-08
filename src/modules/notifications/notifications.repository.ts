import { Injectable } from '@nestjs/common';
import { NotificationRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateNotificationData,
  NotificationAudience,
  NotificationResponse,
} from './interfaces/notification.interface';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    client: PrismaClientLike,
    data: CreateNotificationData,
  ): Promise<NotificationResponse> {
    const created = await client.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        targetRole: data.targetRole ?? NotificationRole.SUPER_ADMIN,
        targetUserId: data.targetUserId ?? null,
      },
    });

    return created;
  }

  async findUnreadIds(audience: NotificationAudience): Promise<string[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        isRead: false,
        ...this.whereFor(audience),
      },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async countUnread(audience: NotificationAudience): Promise<number> {
    return this.prisma.notification.count({
      where: {
        isRead: false,
        ...this.whereFor(audience),
      },
    });
  }

  async findUnread(
    audience: NotificationAudience,
  ): Promise<NotificationResponse[]> {
    return this.prisma.notification.findMany({
      where: {
        isRead: false,
        ...this.whereFor(audience),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecent(
    audience: NotificationAudience,
    take = 20,
  ): Promise<NotificationResponse[]> {
    return this.prisma.notification.findMany({
      where: this.whereFor(audience),
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async findById(id: string): Promise<NotificationResponse | null> {
    return this.prisma.notification.findUnique({
      where: { id },
    });
  }

  async markAsRead(id: string): Promise<NotificationResponse> {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(audience: NotificationAudience): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        isRead: false,
        ...this.whereFor(audience),
      },
      data: { isRead: true },
    });

    return result.count;
  }

  private whereFor(
    audience: NotificationAudience,
  ): Prisma.NotificationWhereInput {
    const personal: Prisma.NotificationWhereInput = {
      targetUserId: audience.userId,
    };

    if (audience.targetRoles.length === 0) {
      return personal;
    }

    return {
      OR: [
        {
          targetRole: { in: audience.targetRoles },
          targetUserId: null,
        },
        { targetUserId: audience.userId },
      ],
    };
  }

  async findUserName(
    client: PrismaClientLike,
    userId: string,
  ): Promise<{ firstName: string; lastName: string } | null> {
    return client.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
      select: {
        firstName: true,
        lastName: true,
      },
    });
  }
}
