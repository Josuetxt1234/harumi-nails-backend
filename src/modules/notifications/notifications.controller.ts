import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  Permissions,
  PermissionsAny,
} from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NotificationRealtimeBus } from './notification-realtime.bus';
import { NotificationsService } from './notifications.service';

const SSE_HEARTBEAT_MS = 25_000;

@Controller('notifications')
@UseGuards(RolesGuard)
@Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.MESA)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly realtime: NotificationRealtimeBus,
  ) {}

  @Sse('stream')
  @PermissionsAny(
    PERMISSIONS.NOTIFICATIONS_LIST,
    PERMISSIONS.PAYROLL_READ,
  )
  stream(@CurrentUser() actor: AuthenticatedUser): Observable<MessageEvent> {
    return merge(
      interval(SSE_HEARTBEAT_MS).pipe(
        map((): MessageEvent => ({ type: 'ping', data: {} })),
      ),
      this.realtime.listen(actor.id),
    );
  }

  @Get()
  @PermissionsAny(
    PERMISSIONS.NOTIFICATIONS_LIST,
    PERMISSIONS.PAYROLL_READ,
  )
  getFeed(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.getFeed(actor);
  }

  @Patch('read-all')
  @PermissionsAny(
    PERMISSIONS.NOTIFICATIONS_UPDATE,
    PERMISSIONS.PAYROLL_READ,
  )
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(actor);
  }

  @Patch(':id/read')
  @PermissionsAny(
    PERMISSIONS.NOTIFICATIONS_UPDATE,
    PERMISSIONS.PAYROLL_READ,
  )
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsRead(actor, id);
  }
}
