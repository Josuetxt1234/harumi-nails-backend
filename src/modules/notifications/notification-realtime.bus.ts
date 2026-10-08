import { Injectable, MessageEvent } from '@nestjs/common';
import { merge, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface NotificationReadSync {
  userId: string;
  notificationIds: string[];
  unreadCount: number;
}

/**
 * In-process fan-out for read-state changes.
 * The HTTP layer publishes; the SSE route subscribes. Neither owns the other.
 */
@Injectable()
export class NotificationRealtimeBus {
  private readonly events = new Subject<NotificationReadSync>();
  private readonly refreshes = new Subject<{ userId: string }>();

  publish(event: NotificationReadSync): void {
    const notificationIds = event.notificationIds.filter(
      (id) => typeof id === 'string' && id.length > 0,
    );

    this.events.next({
      userId: event.userId,
      notificationIds,
      unreadCount: Number.isFinite(event.unreadCount)
        ? Math.max(0, Math.trunc(event.unreadCount))
        : 0,
    });
  }

  publishRefresh(userId: string): void {
    if (typeof userId !== 'string' || userId.length === 0) {
      return;
    }

    this.refreshes.next({ userId });
  }

  listen(userId: string): Observable<MessageEvent> {
    const reads = this.events.pipe(
      filter((event) => event.userId === userId),
      map(
        (event): MessageEvent => ({
          type: 'notifications.read',
          data: {
            notificationIds: event.notificationIds,
            unreadCount: event.unreadCount,
          },
        }),
      ),
    );
    const created = this.refreshes.pipe(
      filter((event) => event.userId === userId),
      map(
        (): MessageEvent => ({
          type: 'notifications.refresh',
          data: { refresh: true },
        }),
      ),
    );

    return merge(reads, created);
  }
}
