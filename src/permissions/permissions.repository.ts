import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PermissionSummary,
  RolePermissionSummary,
} from './interfaces/permission.interface';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<PermissionSummary[]> {
    return this.prisma.permission.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findActiveById(permissionId: string): Promise<PermissionSummary | null> {
    return this.prisma.permission.findFirst({
      where: {
        id: permissionId,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async findActiveByName(name: string): Promise<PermissionSummary | null> {
    return this.prisma.permission.findFirst({
      where: {
        name,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async resolvePermissionNamesForUser(userId: string): Promise<string[]> {
    const assignments = await this.prisma.rolePermission.findMany({
      where: {
        isDeleted: false,
        role: {
          isDeleted: false,
          users: {
            some: {
              userId,
              isDeleted: false,
            },
          },
        },
        permission: {
          isDeleted: false,
        },
      },
      select: {
        permission: {
          select: {
            name: true,
          },
        },
      },
    });

    const uniqueNames = new Set(
      assignments.map((assignment) => assignment.permission.name),
    );

    return Array.from(uniqueNames).sort();
  }

  async findPermissionsByRoleId(roleId: string): Promise<RolePermissionSummary[]> {
    const assignments = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
        isDeleted: false,
        permission: { isDeleted: false },
      },
      select: {
        assignedAt: true,
        permission: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        permission: {
          name: 'asc',
        },
      },
    });

    return assignments.map((assignment) => ({
      id: assignment.permission.id,
      name: assignment.permission.name,
      description: assignment.permission.description,
      assignedAt: assignment.assignedAt,
    }));
  }

  async findActiveRolePermissionAssignment(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.findFirst({
      where: {
        roleId,
        permissionId,
        isDeleted: false,
      },
    });
  }

  async findRevokedRolePermissionAssignment(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.findFirst({
      where: {
        roleId,
        permissionId,
        isDeleted: true,
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });
  }

  async createRolePermissionAssignment(
    roleId: string,
    permissionId: string,
    assignedById: string,
  ): Promise<void> {
    await this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
        assignedById,
      },
    });
  }

  async reactivateRolePermissionAssignment(
    assignmentId: string,
    assignedById: string,
  ): Promise<void> {
    await this.prisma.rolePermission.update({
      where: { id: assignmentId },
      data: {
        isDeleted: false,
        deletedAt: null,
        assignedAt: new Date(),
        assignedById,
        revokedById: null,
      },
    });
  }

  async revokeRolePermissionAssignment(
    assignmentId: string,
    revokedById: string,
  ): Promise<void> {
    await this.prisma.rolePermission.update({
      where: { id: assignmentId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        revokedById,
      },
    });
  }

  async upsertPermissionByName(
    name: string,
    description: string,
  ): Promise<PermissionSummary> {
    const existing = await this.findActiveByName(name);

    if (existing) {
      return existing;
    }

    return this.prisma.permission.create({
      data: {
        name,
        description,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }
}
