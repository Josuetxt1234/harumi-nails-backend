import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserData,
  ListUsersFilters,
  PaginatedUsers,
  UpdateUserData,
  UserDetail,
  UserDetailBase,
  UserListItem,
  UserProfile,
  UserProfileBase,
  UsersMetrics,
  UserWithRoles,
} from './interfaces/user-with-roles.interface';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByEmail(email: string): Promise<UserWithRoles | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isDeleted: false,
      },
      include: this.userRolesInclude(),
    });

    return user ? this.mapToUserWithRoles(user) : null;
  }

  async emailExistsForActiveUser(email: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isDeleted: false,
      },
      select: { id: true },
    });

    return Boolean(user);
  }

  async findActiveProfileById(userId: string): Promise<UserProfileBase | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
        isActive: true,
      },
      include: this.userRolesInclude(),
    });

    return user ? this.mapToUserProfile(user) : null;
  }

  async findActiveById(userId: string): Promise<UserDetailBase | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
      include: this.userRolesInclude(),
    });

    return user ? this.mapToUserDetail(user) : null;
  }

  async findAllActive(filters: ListUsersFilters): Promise<PaginatedUsers> {
    const where = {
      isDeleted: false,
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.roleId
        ? {
            roles: {
              some: {
                isDeleted: false,
                roleId: filters.roleId,
                role: { isDeleted: false },
              },
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                firstName: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                lastName: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: this.userRolesInclude(),
        orderBy: [{ createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: users.map((user) => this.mapToUserListItem(user)),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }

  async getMetrics(roleId?: string): Promise<UsersMetrics> {
    const baseWhere = {
      isDeleted: false,
      ...(roleId
        ? {
            roles: {
              some: {
                isDeleted: false,
                roleId,
                role: { isDeleted: false },
              },
            },
          }
        : {}),
    };

    const [total, active, inactive] = await this.prisma.$transaction([
      this.prisma.user.count({ where: baseWhere }),
      this.prisma.user.count({ where: { ...baseWhere, isActive: true } }),
      this.prisma.user.count({ where: { ...baseWhere, isActive: false } }),
    ]);

    return { total, active, inactive };
  }

  async create(data: CreateUserData) {
    return this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive ?? true,
        createdById: data.createdById,
      },
    });
  }

  async createWithRoles(
    data: CreateUserData,
    roleIds: string[],
  ): Promise<UserDetailBase> {
    const uniqueRoleIds = [...new Set(roleIds)];

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          phone: data.phone,
          avatarUrl: data.avatarUrl,
          isActive: data.isActive ?? true,
          createdById: data.createdById,
          roles: {
            create: uniqueRoleIds.map((roleId) => ({
              roleId,
              assignedById: data.createdById,
            })),
          },
        },
        include: this.userRolesInclude(),
      });

      return this.mapToUserDetail(user);
    });
  }

  async deleteAllSessionsForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async countActiveUsersWithRoleName(roleName: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        isDeleted: false,
        isActive: true,
        roles: {
          some: {
            isDeleted: false,
            role: {
              name: roleName,
              isDeleted: false,
            },
          },
        },
      },
    });
  }

  async update(userId: string, data: UpdateUserData) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.password !== undefined ? { password: data.password } : {}),
        updatedById: data.updatedById,
      },
    });
  }

  async setActiveState(
    userId: string,
    isActive: boolean,
    updatedById: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        updatedById,
      },
    });
  }

  async softDelete(userId: string, deletedById: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
        isActive: false,
      },
    });
  }

  async findActiveRoleAssignment(userId: string, roleId: string) {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        isDeleted: false,
      },
    });
  }

  async findRevokedRoleAssignment(userId: string, roleId: string) {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        isDeleted: true,
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });
  }

  async reactivateRoleAssignment(
    assignmentId: string,
    assignedById: string,
  ): Promise<void> {
    await this.prisma.userRole.update({
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

  async createRoleAssignment(
    userId: string,
    roleId: string,
    assignedById: string,
  ): Promise<void> {
    await this.prisma.userRole.create({
      data: {
        userId,
        roleId,
        assignedById,
      },
    });
  }

  async revokeRoleAssignment(
    assignmentId: string,
    revokedById: string,
  ): Promise<void> {
    await this.prisma.userRole.update({
      where: { id: assignmentId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        revokedById,
      },
    });
  }

  private userRolesInclude() {
    return {
      roles: {
        where: { isDeleted: false },
        include: {
          role: {
            select: {
              name: true,
              isDeleted: true,
            },
          },
        },
      },
    };
  }

  private extractRoleNames(
    userRoles: Array<{
      role: { name: string; isDeleted: boolean };
    }>,
  ): string[] {
    return userRoles
      .filter((userRole) => !userRole.role.isDeleted)
      .map((userRole) => userRole.role.name);
  }

  private mapToUserWithRoles(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    password: string;
    isActive: boolean;
    avatarUrl: string | null;
    roles: Array<{ role: { name: string; isDeleted: boolean } }>;
  }): UserWithRoles {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      password: user.password,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      roles: this.extractRoleNames(user.roles),
    };
  }

  private mapToUserProfile(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    roles: Array<{ role: { name: string; isDeleted: boolean } }>;
  }): UserProfileBase {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roles: this.extractRoleNames(user.roles),
    };
  }

  private mapToUserDetail(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{ role: { name: string; isDeleted: boolean } }>;
  }): UserDetailBase {
    return {
      ...this.mapToUserProfile(user),
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private mapToUserListItem(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    avatarUrl: string | null;
    createdAt: Date;
    roles: Array<{ role: { name: string; isDeleted: boolean } }>;
  }): UserListItem {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      roles: this.extractRoleNames(user.roles),
      createdAt: user.createdAt,
    };
  }
}
