import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ROLES_ERROR_MESSAGES } from '../common/constants/roles-errors.constants';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleSummary } from './interfaces/role.interface';
import { RolesRepository } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async getActiveRoles(): Promise<RoleSummary[]> {
    return this.rolesRepository.findAllActive();
  }

  async getActiveRoleByName(name: string): Promise<RoleSummary> {
    const role = await this.rolesRepository.findActiveByName(name);

    if (!role) {
      throw new NotFoundException(ROLES_ERROR_MESSAGES.ROLE_NOT_FOUND);
    }

    return role;
  }

  async getActiveRoleById(roleId: string): Promise<RoleSummary> {
    const role = await this.rolesRepository.findActiveById(roleId);

    if (!role) {
      throw new NotFoundException(ROLES_ERROR_MESSAGES.ROLE_NOT_FOUND);
    }

    return role;
  }

  async createRole(
    createRoleDto: CreateRoleDto,
    actorUserId: string,
  ): Promise<RoleSummary> {
    const normalizedName = createRoleDto.name.trim().toUpperCase();
    await this.assertRoleNameIsAvailable(normalizedName);

    return this.rolesRepository.create({
      name: normalizedName,
      description: createRoleDto.description?.trim(),
      createdById: actorUserId,
    });
  }

  async updateRole(
    roleId: string,
    updateRoleDto: UpdateRoleDto,
    actorUserId: string,
  ): Promise<RoleSummary> {
    const currentRole = await this.getActiveRoleById(roleId);

    if (updateRoleDto.name) {
      const normalizedName = updateRoleDto.name.trim().toUpperCase();

      if (normalizedName !== currentRole.name) {
        await this.assertRoleNameIsAvailable(normalizedName);
      }
    }

    return this.rolesRepository.update(roleId, {
      ...(updateRoleDto.name !== undefined
        ? { name: updateRoleDto.name.trim().toUpperCase() }
        : {}),
      ...(updateRoleDto.description !== undefined
        ? { description: updateRoleDto.description.trim() || null }
        : {}),
      updatedById: actorUserId,
    });
  }

  async deleteRole(roleId: string, actorUserId: string): Promise<void> {
    await this.assertRoleCanBeDeleted(roleId);
    await this.rolesRepository.softDelete(roleId, actorUserId);
  }

  async assertRoleNameIsAvailable(name: string): Promise<void> {
    const existingRole = await this.rolesRepository.findActiveByName(name);

    if (existingRole) {
      throw new ConflictException(ROLES_ERROR_MESSAGES.ROLE_NAME_ALREADY_IN_USE);
    }
  }

  async assertRoleCanBeDeleted(roleId: string): Promise<void> {
    await this.getActiveRoleById(roleId);

    const assignmentCount =
      await this.rolesRepository.countActiveUserAssignments(roleId);

    if (assignmentCount > 0) {
      throw new ConflictException(ROLES_ERROR_MESSAGES.ROLE_IN_USE);
    }
  }
}
