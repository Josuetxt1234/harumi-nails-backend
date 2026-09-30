import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AssignPermissionDto } from '../permissions/dto/assign-permission.dto';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @Permissions(PERMISSIONS.ROLES_LIST)
  getRoles() {
    return this.rolesService.getActiveRoles();
  }

  @Get(':id/permissions')
  @Permissions(PERMISSIONS.ROLES_READ)
  getRolePermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.getPermissionsForRole(id);
  }

  @Post(':id/permissions')
  @Permissions(PERMISSIONS.PERMISSIONS_ASSIGN_TO_ROLE)
  assignPermissionToRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignPermissionDto: AssignPermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.permissionsService.assignPermissionToRole(
      id,
      assignPermissionDto,
      actor.id,
    );
  }

  @Delete(':id/permissions/:permissionId')
  @Permissions(PERMISSIONS.PERMISSIONS_ASSIGN_TO_ROLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePermissionFromRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.permissionsService.revokePermissionFromRole(
      id,
      permissionId,
      actor.id,
    );
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLES_READ)
  getRoleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.getActiveRoleById(id);
  }

  @Post()
  @Permissions(PERMISSIONS.ROLES_CREATE)
  createRole(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.createRole(createRoleDto, actor.id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLES_UPDATE)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.updateRole(id, updateRoleDto, actor.id);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROLES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.rolesService.deleteRole(id, actor.id);
  }
}
