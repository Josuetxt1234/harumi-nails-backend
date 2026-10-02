import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationRole, NotificationType, Prisma } from '@prisma/client';
import { AUTH_ERROR_MESSAGES } from '../../common/constants/auth.constants';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  buildVoucherCancelledMessage,
  buildVoucherCreatedMessage,
  formatUserDisplayName,
  VOUCHER_NOTIFICATION_COPY,
} from './constants/notification-copy.constants';
import {
  NotificationsFeed,
  NotificationResponse,
} from './interfaces/notification.interface';
import { NotificationsRepository } from './notifications.repository';

type PrismaClientLike = Prisma.TransactionClient;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  async getFeed(actor: AuthenticatedUser): Promise<NotificationsFeed> {
    const targetRoles = this.resolveTargetRoles(actor);

    const [unread, recent] = await Promise.all([
      this.notificationsRepository.findUnread(targetRoles),
      this.notificationsRepository.findRecent(targetRoles, 20),
    ]);

    return { unread, recent };
  }

  async markAsRead(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<NotificationResponse> {
    const targetRoles = this.resolveTargetRoles(actor);
    const notification = await this.notificationsRepository.findById(id);

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (!targetRoles.includes(notification.targetRole)) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    if (notification.isRead) {
      return notification;
    }

    return this.notificationsRepository.markAsRead(id);
  }

  async markAllAsRead(
    actor: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    const targetRoles = this.resolveTargetRoles(actor);
    const updated = await this.notificationsRepository.markAllAsRead(targetRoles);
    return { updated };
  }

  async notifyVoucherCreated(
    client: PrismaClientLike,
    input: {
      actorId: string;
      amount: number;
      mesaName: string;
    },
  ): Promise<void> {
    const actorName = await this.resolveActorName(client, input.actorId);

    await this.notificationsRepository.create(client, {
      title: VOUCHER_NOTIFICATION_COPY.createdTitle,
      message: buildVoucherCreatedMessage(
        actorName,
        input.amount,
        input.mesaName,
      ),
      type: NotificationType.VOUCHER_CREATED,
      targetRole: NotificationRole.SUPER_ADMIN,
    });
  }

  async notifyVoucherCancelled(
    client: PrismaClientLike,
    input: {
      actorId: string;
      amount: number;
      mesaName: string;
      reason: string;
    },
  ): Promise<void> {
    const actorName = await this.resolveActorName(client, input.actorId);

    await this.notificationsRepository.create(client, {
      title: VOUCHER_NOTIFICATION_COPY.cancelledTitle,
      message: buildVoucherCancelledMessage(
        actorName,
        input.amount,
        input.mesaName,
        input.reason,
      ),
      type: NotificationType.VOUCHER_CANCELLED,
      targetRole: NotificationRole.SUPER_ADMIN,
    });
  }

  private async resolveActorName(
    client: PrismaClientLike,
    actorId: string,
  ): Promise<string> {
    const actor = await this.notificationsRepository.findUserName(
      client,
      actorId,
    );

    return formatUserDisplayName(actor?.firstName, actor?.lastName);
  }

  private resolveTargetRoles(actor: AuthenticatedUser): NotificationRole[] {
    const roles = new Set<NotificationRole>();

    for (const role of actor.roles) {
      if (role === SYSTEM_ROLES.SUPER_ADMIN) {
        roles.add(NotificationRole.SUPER_ADMIN);
      }
      if (role === SYSTEM_ROLES.ADMIN) {
        roles.add(NotificationRole.ADMIN);
      }
      if (role === SYSTEM_ROLES.MESA) {
        roles.add(NotificationRole.MESA);
      }
    }

    return [...roles];
  }
}
