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
  DEFAULT_SALON_TIMEZONE,
  getCalendarDateInTimeZone,
} from '../../common/utils/date.util';
import {
  buildPayrollClosedAdminMessage,
  buildPayrollClosedMesaMessage,
  buildPayrollGeneratedAdminMessage,
  buildVoucherCancelledMessage,
  buildVoucherCreatedMessage,
  formatUserDisplayName,
  PAYROLL_NOTIFICATION_COPY,
  VOUCHER_NOTIFICATION_COPY,
} from './constants/notification-copy.constants';
import {
  NotificationAudience,
  NotificationsFeed,
  NotificationResponse,
} from './interfaces/notification.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationRealtimeBus } from './notification-realtime.bus';
import { NotificationsRepository } from './notifications.repository';

type PrismaClientLike = Prisma.TransactionClient;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly prisma: PrismaService,
    private readonly realtime: NotificationRealtimeBus,
  ) {}

  async getFeed(actor: AuthenticatedUser): Promise<NotificationsFeed> {
    const audience = this.audienceFor(actor);

    const [unread, recent] = await Promise.all([
      this.notificationsRepository.findUnread(audience),
      this.notificationsRepository.findRecent(audience, 20),
    ]);

    return { unread, recent };
  }

  async markAsRead(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<NotificationResponse> {
    const audience = this.audienceFor(actor);
    const notification = await this.notificationsRepository.findById(id);

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (!this.canAccess(notification, actor)) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    if (notification.isRead) {
      return notification;
    }

    const updated = await this.notificationsRepository.markAsRead(id);
    const unreadCount =
      await this.notificationsRepository.countUnread(audience);
    this.publishReadSync(actor.id, [updated.id], unreadCount);
    return updated;
  }

  async markAllAsRead(
    actor: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    const audience = this.audienceFor(actor);
    const notificationIds =
      await this.notificationsRepository.findUnreadIds(audience);
    const updated =
      await this.notificationsRepository.markAllAsRead(audience);

    if (updated > 0) {
      this.publishReadSync(actor.id, notificationIds, 0);
    }

    return { updated };
  }

  private publishReadSync(
    userId: string,
    notificationIds: string[],
    unreadCount: number,
  ): void {
    this.realtime.publish({ userId, notificationIds, unreadCount });
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

  async notifyPayrollGenerated(input: {
    actorId: string;
    mesaUserId: string;
    mesaName: string;
    netPayable: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    await this.dispatchPayrollNotifications({
      ...input,
      type: NotificationType.PAYROLL_GENERATED,
      adminTitle: PAYROLL_NOTIFICATION_COPY.generatedTitle,
      mesaTitle: PAYROLL_NOTIFICATION_COPY.generatedMesaTitle,
      adminMessage: buildPayrollGeneratedAdminMessage,
      mesaMessage: () => PAYROLL_NOTIFICATION_COPY.generatedMesaMessage,
    });
  }

  async notifyPayrollDraftUpdated(mesaUserId: string): Promise<void> {
    if (mesaUserId.length === 0) {
      return;
    }

    await this.notificationsRepository.create(this.prisma, {
      title: PAYROLL_NOTIFICATION_COPY.updatedMesaTitle,
      message: PAYROLL_NOTIFICATION_COPY.updatedMesaMessage,
      type: NotificationType.PAYROLL_GENERATED,
      targetRole: NotificationRole.MESA,
      targetUserId: mesaUserId,
    });
    this.realtime.publishRefresh(mesaUserId);
  }

  async notifyPayrollClosed(input: {
    actorId: string;
    mesaUserId: string;
    mesaName: string;
    netPayable: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    await this.dispatchPayrollNotifications({
      ...input,
      type: NotificationType.PAYROLL_CLOSED,
      adminTitle: PAYROLL_NOTIFICATION_COPY.closedTitle,
      mesaTitle: PAYROLL_NOTIFICATION_COPY.closedMesaTitle,
      adminMessage: buildPayrollClosedAdminMessage,
      mesaMessage: buildPayrollClosedMesaMessage,
    });
  }

  private async dispatchPayrollNotifications(input: {
    actorId: string;
    mesaUserId: string;
    mesaName: string;
    netPayable: number;
    periodStart: Date;
    periodEnd: Date;
    type: NotificationType;
    adminTitle: string;
    mesaTitle: string;
    adminMessage: (
      actorName: string,
      mesaName: string,
      periodLabel: string,
      netPayable: number,
    ) => string;
    mesaMessage: (
      mesaName: string,
      periodLabel: string,
      netPayable: number,
    ) => string;
  }): Promise<void> {
    const actorName = await this.resolveActorName(this.prisma, input.actorId);
    const periodLabel = this.formatPayrollPeriod(
      input.periodStart,
      input.periodEnd,
    );
    const adminMessage = input.adminMessage(
      actorName,
      input.mesaName,
      periodLabel,
      input.netPayable,
    );
    const mesaMessage = input.mesaMessage(
      input.mesaName,
      periodLabel,
      input.netPayable,
    );

    await this.notificationsRepository.create(this.prisma, {
      title: input.adminTitle,
      message: adminMessage,
      type: input.type,
      targetRole: NotificationRole.SUPER_ADMIN,
    });
    await this.notificationsRepository.create(this.prisma, {
      title: input.adminTitle,
      message: adminMessage,
      type: input.type,
      targetRole: NotificationRole.ADMIN,
    });
    if (input.mesaUserId.length > 0) {
      await this.notificationsRepository.create(this.prisma, {
        title: input.mesaTitle,
        message: mesaMessage,
        type: input.type,
        targetRole: NotificationRole.MESA,
        targetUserId: input.mesaUserId,
      });
      this.realtime.publishRefresh(input.mesaUserId);
    }
  }

  private formatPayrollPeriod(start: Date, end: Date): string {
    const format = (instant: Date): string => {
      const civil = getCalendarDateInTimeZone(instant, DEFAULT_SALON_TIMEZONE);
      const day = String(civil.day).padStart(2, '0');
      const month = String(civil.month).padStart(2, '0');
      return `${day}/${month}/${civil.year}`;
    };

    return `${format(start)} – ${format(end)}`;
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

  private audienceFor(actor: AuthenticatedUser): NotificationAudience {
    return {
      userId: actor.id,
      targetRoles: this.resolveTargetRoles(actor),
    };
  }

  private canAccess(
    notification: NotificationResponse,
    actor: AuthenticatedUser,
  ): boolean {
    if (notification.targetUserId) {
      return notification.targetUserId === actor.id;
    }

    return this.resolveTargetRoles(actor).includes(notification.targetRole);
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
