import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Permissions(PERMISSIONS.PERMISSIONS_LIST)
  getPermissions() {
    return this.permissionsService.getActivePermissions();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.PERMISSIONS_READ)
  getPermissionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.getActivePermissionById(id);
  }
}
