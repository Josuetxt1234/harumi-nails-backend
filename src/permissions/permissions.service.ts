import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS_ERROR_MESSAGES } from '../common/constants/permissions-errors.constants';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import {
  PermissionSummary,
  RolePermissionSummary,
} from './interfaces/permission.interface';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async getActivePermissions(): Promise<PermissionSummary[]> {
    return this.permissionsRepository.findAllActive();
  }

  async getActivePermissionById(permissionId: string): Promise<PermissionSummary> {
    const permission = await this.permissionsRepository.findActiveById(permissionId);

    if (!permission) {
      throw new NotFoundException(PERMISSIONS_ERROR_MESSAGES.PERMISSION_NOT_FOUND);
    }

    return permission;
  }

  async resolveForUser(userId: string): Promise<string[]> {
    return this.permissionsRepository.resolvePermissionNamesForUser(userId);
  }

  async getPermissionsForRole(roleId: string): Promise<RolePermissionSummary[]> {
    return this.permissionsRepository.findPermissionsByRoleId(roleId);
  }

  async assignPermissionToRole(
    roleId: string,
    assignPermissionDto: AssignPermissionDto,
    actorUserId: string,
  ): Promise<RolePermissionSummary[]> {
    await this.getActivePermissionById(assignPermissionDto.permissionId);

    const activeAssignment =
      await this.permissionsRepository.findActiveRolePermissionAssignment(
        roleId,
        assignPermissionDto.permissionId,
      );

    if (activeAssignment) {
      throw new ConflictException(
        PERMISSIONS_ERROR_MESSAGES.PERMISSION_ALREADY_ASSIGNED,
      );
    }

    const revokedAssignment =
      await this.permissionsRepository.findRevokedRolePermissionAssignment(
        roleId,
        assignPermissionDto.permissionId,
      );

    if (revokedAssignment) {
      await this.permissionsRepository.reactivateRolePermissionAssignment(
        revokedAssignment.id,
        actorUserId,
      );
    } else {
      await this.permissionsRepository.createRolePermissionAssignment(
        roleId,
        assignPermissionDto.permissionId,
        actorUserId,
      );
    }

    return this.getPermissionsForRole(roleId);
  }

  async revokePermissionFromRole(
    roleId: string,
    permissionId: string,
    actorUserId: string,
  ): Promise<RolePermissionSummary[]> {
    await this.getActivePermissionById(permissionId);

    const activeAssignment =
      await this.permissionsRepository.findActiveRolePermissionAssignment(
        roleId,
        permissionId,
      );

    if (!activeAssignment) {
      throw new NotFoundException(
        PERMISSIONS_ERROR_MESSAGES.PERMISSION_NOT_ASSIGNED,
      );
    }

    await this.permissionsRepository.revokeRolePermissionAssignment(
      activeAssignment.id,
      actorUserId,
    );

    return this.getPermissionsForRole(roleId);
  }
}
