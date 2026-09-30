import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoleData,
  RoleSummary,
  UpdateRoleData,
} from './interfaces/role.interface';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<RoleSummary[]> {
    return this.prisma.role.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findActiveById(roleId: string): Promise<RoleSummary | null> {
    return this.prisma.role.findFirst({
      where: {
        id: roleId,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async findActiveByName(name: string): Promise<RoleSummary | null> {
    return this.prisma.role.findFirst({
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

  async countActiveUserAssignments(roleId: string): Promise<number> {
    return this.prisma.userRole.count({
      where: {
        roleId,
        isDeleted: false,
      },
    });
  }

  async create(data: CreateRoleData): Promise<RoleSummary> {
    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        createdById: data.createdById,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async update(roleId: string, data: UpdateRoleData): Promise<RoleSummary> {
    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        updatedById: data.updatedById,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async softDelete(roleId: string, deletedById: string): Promise<void> {
    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
      },
    });
  }
}
