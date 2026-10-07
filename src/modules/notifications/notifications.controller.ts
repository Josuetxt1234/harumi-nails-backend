import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(RolesGuard)
@Roles(SYSTEM_ROLES.SUPER_ADMIN)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions(PERMISSIONS.NOTIFICATIONS_LIST)
  getFeed(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.getFeed(actor);
  }

  @Patch('read-all')
  @Permissions(PERMISSIONS.NOTIFICATIONS_UPDATE)
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(actor);
  }

  @Patch(':id/read')
  @Permissions(PERMISSIONS.NOTIFICATIONS_UPDATE)
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsRead(actor, id);
  }
}
