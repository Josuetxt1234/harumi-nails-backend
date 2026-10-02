import { Injectable } from '@nestjs/common';
import { NotificationRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateNotificationData,
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
      },
    });

    return created;
  }

  async findUnread(
    targetRoles: NotificationRole[],
  ): Promise<NotificationResponse[]> {
    if (targetRoles.length === 0) {
      return [];
    }

    return this.prisma.notification.findMany({
      where: {
        isRead: false,
        targetRole: { in: targetRoles },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecent(
    targetRoles: NotificationRole[],
    take = 20,
  ): Promise<NotificationResponse[]> {
    if (targetRoles.length === 0) {
      return [];
    }

    return this.prisma.notification.findMany({
      where: {
        targetRole: { in: targetRoles },
      },
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

  async markAllAsRead(targetRoles: NotificationRole[]): Promise<number> {
    if (targetRoles.length === 0) {
      return 0;
    }

    const result = await this.prisma.notification.updateMany({
      where: {
        isRead: false,
        targetRole: { in: targetRoles },
      },
      data: { isRead: true },
    });

    return result.count;
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
