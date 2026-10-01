import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_ERROR_MESSAGES } from '../common/constants/auth.constants';
import { SYSTEM_ROLES } from '../common/constants/roles.constants';
import { USERS_ERROR_MESSAGES } from '../common/constants/users.constants';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { HashingService } from '../hashing/hashing.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PaginatedUsers,
  UserDetail,
  UserProfile,
  UsersMetrics,
  UserWithRoles,
} from './interfaces/user-with-roles.interface';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
    private readonly hashingService: HashingService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async findActiveByEmail(email: string): Promise<UserWithRoles | null> {
    return this.usersRepository.findActiveByEmail(email);
  }

  async getActiveProfileById(userId: string): Promise<UserProfile | null> {
    const user = await this.usersRepository.findActiveProfileById(userId);

    if (!user) {
      return null;
    }

    return this.enrichWithPermissions(user);
  }

  async getActiveProfileOrFail(userId: string): Promise<UserProfile> {
    const user = await this.getActiveProfileById(userId);

    if (!user) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return user;
  }

  async getMyProfile(userId: string): Promise<UserDetail> {
    return this.getUserById(userId);
  }

  async listUsers(
    query: ListUsersQueryDto,
    actorRoles: string[],
  ): Promise<PaginatedUsers> {
    const filters = {
      search: query.search,
      isActive: query.isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      roleId: query.roleId,
    };

    if (this.isAdminOnly(actorRoles)) {
      const mesaRole = await this.rolesService.getActiveRoleByName(
        SYSTEM_ROLES.MESA,
      );
      filters.roleId = mesaRole.id;
    }

    return this.usersRepository.findAllActive(filters);
  }

  async getUsersMetrics(
    actorRoles: string[],
    roleId?: string,
  ): Promise<UsersMetrics> {
    let resolvedRoleId = roleId;

    if (this.isAdminOnly(actorRoles)) {
      const mesaRole = await this.rolesService.getActiveRoleByName(
        SYSTEM_ROLES.MESA,
      );
      resolvedRoleId = mesaRole.id;
    }

    return this.usersRepository.getMetrics(resolvedRoleId);
  }

  async getUserById(userId: string): Promise<UserDetail> {
    const user = await this.usersRepository.findActiveById(userId);

    if (!user) {
      throw new NotFoundException(USERS_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return this.enrichWithPermissions(user);
  }

  async getUserByIdForActor(
    userId: string,
    actorRoles: string[],
  ): Promise<UserDetail> {
    const targetUser = await this.getUserById(userId);
    this.assertActorCanManageTargetUser({ roles: actorRoles }, targetUser);
    return targetUser;
  }

  async createUser(
    createUserDto: CreateUserDto,
    actorUserId: string,
    actorRoles: string[],
    avatarFile?: Express.Multer.File,
  ): Promise<UserDetail> {
    const roleIds = [...new Set(createUserDto.roleIds ?? [])];

    if (roleIds.length === 0) {
      throw new BadRequestException(USERS_ERROR_MESSAGES.ROLE_REQUIRED);
    }

    await this.assertEmailIsAvailable(createUserDto.email);

    for (const roleId of roleIds) {
      const role = await this.rolesService.getActiveRoleById(roleId);
      this.assertActorCanAssignRole(actorRoles, role.name);
    }

    const hashedPassword = await this.hashingService.hashPassword(
      createUserDto.password,
    );

    let avatarUrl: string | undefined;
    let uploadedPublicId: string | undefined;

    if (avatarFile) {
      const uploadResult = await this.cloudinaryService.uploadImage(avatarFile);
      avatarUrl = uploadResult.secureUrl;
      uploadedPublicId = uploadResult.publicId;
    }

    try {
      const createdUser = await this.usersRepository.createWithRoles(
        {
          firstName: createUserDto.firstName.trim(),
          lastName: createUserDto.lastName.trim(),
          email: createUserDto.email,
          password: hashedPassword,
          phone: createUserDto.phone?.trim(),
          avatarUrl,
          isActive: createUserDto.isActive,
          createdById: actorUserId,
        },
        roleIds,
      );

      return this.getUserById(createdUser.id);
    } catch (error) {
      if (uploadedPublicId) {
        try {
          await this.cloudinaryService.deleteImage(uploadedPublicId);
        } catch {
          // DB failure is the source of truth; avatar cleanup is best-effort.
        }
      }

      throw error;
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    actorUserId: string,
    actorRoles: string[],
    avatarFile?: Express.Multer.File,
  ): Promise<UserDetail> {
    const currentUser = await this.getUserByIdForActor(userId, actorRoles);

    const updateData: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      password?: string;
      updatedById: string;
    } = {
      updatedById: actorUserId,
    };

    if (updateUserDto.firstName !== undefined) {
      updateData.firstName = updateUserDto.firstName.trim();
    }

    if (updateUserDto.lastName !== undefined) {
      updateData.lastName = updateUserDto.lastName.trim();
    }

    if (updateUserDto.phone !== undefined) {
      updateData.phone = updateUserDto.phone.trim() || null;
    }

    if (updateUserDto.password) {
      updateData.password = await this.hashingService.hashPassword(
        updateUserDto.password,
      );
    }

    if (avatarFile) {
      const uploadResult = await this.cloudinaryService.uploadImage(avatarFile);
      updateData.avatarUrl = uploadResult.secureUrl;

      const previousPublicId = this.cloudinaryService.extractPublicIdFromUrl(
        currentUser.avatarUrl,
      );

      if (previousPublicId) {
        try {
          await this.cloudinaryService.deleteImage(previousPublicId);
        } catch {
          // Keep the update even if the previous avatar could not be deleted.
        }
      }
    }

    await this.usersRepository.update(userId, updateData);

    return this.getUserById(userId);
  }

  async updateMyProfile(
    userId: string,
    updateMyProfileDto: UpdateMyProfileDto,
    avatarFile?: Express.Multer.File,
  ): Promise<UserDetail> {
    const currentUser = await this.getUserById(userId);

    const updateData: {
      phone?: string | null;
      avatarUrl?: string | null;
      updatedById: string;
    } = {
      updatedById: userId,
    };

    if (updateMyProfileDto.phone !== undefined) {
      updateData.phone = updateMyProfileDto.phone.trim() || null;
    }

    if (avatarFile) {
      const uploadResult = await this.cloudinaryService.uploadImage(avatarFile);
      updateData.avatarUrl = uploadResult.secureUrl;

      const previousPublicId = this.cloudinaryService.extractPublicIdFromUrl(
        currentUser.avatarUrl,
      );

      if (previousPublicId) {
        try {
          await this.cloudinaryService.deleteImage(previousPublicId);
        } catch {
          // Keep the update even if the previous avatar could not be deleted.
        }
      }
    }

    await this.usersRepository.update(userId, updateData);

    return this.getUserById(userId);
  }

  async changeMyPassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    if (!changePasswordDto.currentPassword) {
      throw new BadRequestException('Current password is required.');
    }

    const userWithPassword = await this.findActiveByEmailForPassword(userId);

    const isCurrentPasswordValid = await this.verifyPassword(
      changePasswordDto.currentPassword,
      userWithPassword.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException(USERS_ERROR_MESSAGES.INVALID_CURRENT_PASSWORD);
    }

    const hashedPassword = await this.hashingService.hashPassword(
      changePasswordDto.newPassword,
    );

    await this.usersRepository.update(userId, {
      password: hashedPassword,
      updatedById: userId,
    });
    await this.usersRepository.deleteAllSessionsForUser(userId);
  }

  async forceChangePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    actorUserId: string,
    actorRoles: string[],
  ): Promise<void> {
    await this.getUserByIdForActor(userId, actorRoles);

    const hashedPassword = await this.hashingService.hashPassword(
      changePasswordDto.newPassword,
    );

    await this.usersRepository.update(userId, {
      password: hashedPassword,
      updatedById: actorUserId,
    });
    await this.usersRepository.deleteAllSessionsForUser(userId);
  }

  async activateUser(
    userId: string,
    actorUserId: string,
    actorRoles: string[] = [SYSTEM_ROLES.SUPER_ADMIN],
  ): Promise<UserDetail> {
    await this.getUserByIdForActor(userId, actorRoles);
    await this.usersRepository.setActiveState(userId, true, actorUserId);
    return this.getUserById(userId);
  }

  async deactivateUser(
    userId: string,
    actorUserId: string,
    actorRoles: string[] = [SYSTEM_ROLES.SUPER_ADMIN],
  ): Promise<UserDetail> {
    this.assertUserCanManageTarget(actorUserId, userId, 'deactivate');
    const targetUser = await this.getUserByIdForActor(userId, actorRoles);
    await this.assertNotLastActiveSuperAdmin(targetUser);
    await this.usersRepository.setActiveState(userId, false, actorUserId);
    await this.usersRepository.deleteAllSessionsForUser(userId);
    return this.getUserById(userId);
  }

  async deleteUser(
    userId: string,
    actorUserId: string,
    actorRoles: string[],
  ): Promise<void> {
    this.assertUserCanManageTarget(actorUserId, userId, 'delete');
    const user = await this.getUserByIdForActor(userId, actorRoles);
    await this.assertNotLastActiveSuperAdmin(user);
    await this.usersRepository.softDelete(userId, actorUserId);
    await this.usersRepository.deleteAllSessionsForUser(userId);

    const publicId = this.cloudinaryService.extractPublicIdFromUrl(
      user.avatarUrl,
    );

    if (publicId) {
      try {
        await this.cloudinaryService.deleteImage(publicId);
      } catch {
        // Soft delete succeeds even if Cloudinary cleanup fails.
      }
    }
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    actorUserId: string,
    actorRoles: string[],
  ): Promise<UserDetail> {
    await this.getUserByIdForActor(userId, actorRoles);

    const role = await this.rolesService.getActiveRoleById(roleId);
    this.assertActorCanAssignRole(actorRoles, role.name);

    const activeAssignment = await this.usersRepository.findActiveRoleAssignment(
      userId,
      roleId,
    );

    if (activeAssignment) {
      throw new ConflictException(USERS_ERROR_MESSAGES.ROLE_ALREADY_ASSIGNED);
    }

    const revokedAssignment =
      await this.usersRepository.findRevokedRoleAssignment(userId, roleId);

    if (revokedAssignment) {
      await this.usersRepository.reactivateRoleAssignment(
        revokedAssignment.id,
        actorUserId,
      );
    } else {
      await this.usersRepository.createRoleAssignment(
        userId,
        roleId,
        actorUserId,
      );
    }

    return this.getUserById(userId);
  }

  async revokeRoleFromUser(
    userId: string,
    roleId: string,
    actorUserId: string,
    actorRoles: string[],
  ): Promise<UserDetail> {
    const targetUser = await this.getUserByIdForActor(userId, actorRoles);
    const role = await this.rolesService.getActiveRoleById(roleId);

    if (role.name === SYSTEM_ROLES.SUPER_ADMIN) {
      await this.assertNotLastActiveSuperAdmin(targetUser);
    }

    const activeAssignment = await this.usersRepository.findActiveRoleAssignment(
      userId,
      roleId,
    );

    if (!activeAssignment) {
      throw new NotFoundException(USERS_ERROR_MESSAGES.ROLE_NOT_ASSIGNED);
    }

    await this.usersRepository.revokeRoleAssignment(
      activeAssignment.id,
      actorUserId,
    );

    return this.getUserById(userId);
  }

  async verifyPassword(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return this.hashingService.comparePassword(
      plainTextPassword,
      hashedPassword,
    );
  }

  assertUserExistsForAuthentication(
    user: UserWithRoles | null,
  ): asserts user is UserWithRoles {
    if (!user) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }
  }

  assertUserIsActive(user: UserWithRoles): void {
    if (!user.isActive) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);
    }
  }

  assertUserHasRoles(user: Pick<UserWithRoles, 'roles'>): void {
    if (user.roles.length === 0) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.NO_ROLES_ASSIGNED);
    }
  }

  assertUserCanManageTarget(
    actorUserId: string,
    targetUserId: string,
    action: 'deactivate' | 'delete',
  ): void {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException(
        action === 'deactivate'
          ? USERS_ERROR_MESSAGES.CANNOT_DEACTIVATE_SELF
          : USERS_ERROR_MESSAGES.CANNOT_DELETE_SELF,
      );
    }
  }

  assertActorCanAssignRole(
    actorRoles: string[],
    targetRoleName: string,
  ): void {
    if (this.isAdminOnly(actorRoles) && targetRoleName !== SYSTEM_ROLES.MESA) {
      throw new ForbiddenException(USERS_ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
    }

    if (targetRoleName === SYSTEM_ROLES.SUPER_ADMIN) {
      const canAssignSuperAdmin = actorRoles.includes(SYSTEM_ROLES.SUPER_ADMIN);

      if (!canAssignSuperAdmin) {
        throw new ForbiddenException(USERS_ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
      }
    }
  }

  assertActorCanManageTargetUser(
    actor: { roles: string[] },
    targetUser: Pick<UserDetail, 'id' | 'roles'>,
  ): void {
    if (actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      return;
    }

    if (this.isAdminOnly(actor.roles)) {
      const canManage =
        targetUser.roles.length > 0 &&
        targetUser.roles.every((role) => role === SYSTEM_ROLES.MESA);

      if (!canManage) {
        throw new ForbiddenException(USERS_ERROR_MESSAGES.CANNOT_MANAGE_USER);
      }

      return;
    }

    throw new ForbiddenException(USERS_ERROR_MESSAGES.CANNOT_MANAGE_USER);
  }

  private async assertNotLastActiveSuperAdmin(
    targetUser: Pick<UserDetail, 'roles' | 'isActive'>,
  ): Promise<void> {
    if (!targetUser.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      return;
    }

    if (!targetUser.isActive) {
      return;
    }

    const activeSuperAdmins =
      await this.usersRepository.countActiveUsersWithRoleName(
        SYSTEM_ROLES.SUPER_ADMIN,
      );

    if (activeSuperAdmins <= 1) {
      throw new ForbiddenException(
        USERS_ERROR_MESSAGES.CANNOT_MODIFY_LAST_SUPER_ADMIN,
      );
    }
  }

  private isAdminOnly(actorRoles: string[]): boolean {
    return (
      actorRoles.includes(SYSTEM_ROLES.ADMIN) &&
      !actorRoles.includes(SYSTEM_ROLES.SUPER_ADMIN)
    );
  }

  private async findActiveByEmailForPassword(
    userId: string,
  ): Promise<UserWithRoles> {
    const user = await this.usersRepository.findActiveById(userId);

    if (!user) {
      throw new NotFoundException(USERS_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const userWithPassword = await this.usersRepository.findActiveByEmail(
      user.email,
    );

    if (!userWithPassword) {
      throw new NotFoundException(USERS_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return userWithPassword;
  }

  private async enrichWithPermissions<T extends { id: string }>(
    user: T,
  ): Promise<T & { permissions: string[] }> {
    const permissions = await this.permissionsService.resolveForUser(user.id);

    return {
      ...user,
      permissions,
    };
  }

  private async assertEmailIsAvailable(email: string): Promise<void> {
    const emailExists = await this.usersRepository.emailExistsForActiveUser(
      email,
    );

    if (emailExists) {
      throw new ConflictException(USERS_ERROR_MESSAGES.EMAIL_ALREADY_IN_USE);
    }
  }
}
