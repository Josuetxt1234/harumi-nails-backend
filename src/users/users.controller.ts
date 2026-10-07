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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AllowTemporaryPassword } from '../auth/decorators/allow-temporary-password.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { OptionalImageFileValidationPipe } from '../common/pipes/optional-image-file-validation.pipe';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersMetricsQueryDto } from './dto/users-metrics-query.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { avatarUploadOptions } from './config/avatar-upload.config';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Permissions(PERMISSIONS.PROFILE_READ)
  getMyProfile(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.getMyProfile(actor.id);
  }

  @Patch('me')
  @Permissions(PERMISSIONS.PROFILE_UPDATE)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  updateMyProfile(
    @Body() updateMyProfileDto: UpdateMyProfileDto,
    @UploadedFile(OptionalImageFileValidationPipe)
    avatarFile: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateMyProfile(
      actor.id,
      updateMyProfileDto,
      avatarFile,
    );
  }

  @Patch('me/password')
  @AllowTemporaryPassword()
  @Permissions(PERMISSIONS.PROFILE_CHANGE_PASSWORD)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeMyPassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.changeMyPassword(actor.id, changePasswordDto);
  }

  @Post()
  @Permissions(PERMISSIONS.USERS_CREATE)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  createUser(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile(OptionalImageFileValidationPipe)
    avatarFile: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.createUser(
      createUserDto,
      actor.id,
      actor.roles,
      avatarFile,
    );
  }

  @Get()
  @Permissions(PERMISSIONS.USERS_LIST)
  listUsers(
    @Query() query: ListUsersQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.listUsers(query, actor.roles);
  }

  @Get('metrics')
  @Permissions(PERMISSIONS.USERS_LIST)
  getUsersMetrics(
    @Query() query: UsersMetricsQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.getUsersMetrics(actor.roles, query.roleId);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USERS_READ)
  getUserById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.getUserByIdForActor(id, actor.roles);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USERS_UPDATE)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile(OptionalImageFileValidationPipe)
    avatarFile: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateUser(
      id,
      updateUserDto,
      actor.id,
      actor.roles,
      avatarFile,
    );
  }

  @Patch(':id/password')
  @Permissions(PERMISSIONS.USERS_FORCE_PASSWORD_RESET)
  @HttpCode(HttpStatus.NO_CONTENT)
  async forceChangePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.forceChangePassword(
      id,
      changePasswordDto,
      actor.id,
      actor.roles,
    );
  }

  @Patch(':id/activate')
  @Permissions(PERMISSIONS.USERS_ACTIVATE)
  activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.activateUser(id, actor.id, actor.roles);
  }

  @Patch(':id/deactivate')
  @Permissions(PERMISSIONS.USERS_DEACTIVATE)
  deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.deactivateUser(id, actor.id, actor.roles);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.USERS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.deleteUser(id, actor.id, actor.roles);
  }

  @Post(':id/roles')
  @Permissions(PERMISSIONS.USERS_ASSIGN_ROLE)
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignRoleDto: AssignRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.assignRoleToUser(
      id,
      assignRoleDto.roleId,
      actor.id,
      actor.roles,
    );
  }

  @Delete(':id/roles/:roleId')
  @Permissions(PERMISSIONS.USERS_REVOKE_ROLE)
  revokeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.revokeRoleFromUser(
      id,
      roleId,
      actor.id,
      actor.roles,
    );
  }
}
