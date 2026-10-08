import { PrismaClient } from '@prisma/client';
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_PERMISSION_MAP,
} from '../src/common/constants/permissions.constants';

export async function seedPermissions(
  prisma: PrismaClient,
): Promise<Record<string, string>> {
  const permissionIds: Record<string, string> = {};

  for (const permissionName of ALL_PERMISSIONS) {
    const existingPermission = await prisma.permission.findFirst({
      where: {
        name: permissionName,
        isDeleted: false,
      },
    });

    if (existingPermission) {
      permissionIds[permissionName] = existingPermission.id;
      continue;
    }

    const deletedPermission = await prisma.permission.findFirst({
      where: {
        name: permissionName,
        isDeleted: true,
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });

    if (deletedPermission) {
      await prisma.permission.update({
        where: { id: deletedPermission.id },
        data: {
          isDeleted: false,
          deletedAt: null,
          description: PERMISSION_DESCRIPTIONS[permissionName],
        },
      });

      permissionIds[permissionName] = deletedPermission.id;
      continue;
    }

    const permission = await prisma.permission.create({
      data: {
        name: permissionName,
        description: PERMISSION_DESCRIPTIONS[permissionName],
      },
    });

    permissionIds[permissionName] = permission.id;
  }

  return permissionIds;
}

async function ensureRolePermission(
  prisma: PrismaClient,
  roleId: string,
  permissionId: string,
  assignedById?: string,
): Promise<void> {
  const activeAssignment = await prisma.rolePermission.findFirst({
    where: {
      roleId,
      permissionId,
      isDeleted: false,
    },
  });

  if (activeAssignment) {
    return;
  }

  const revokedAssignment = await prisma.rolePermission.findFirst({
    where: {
      roleId,
      permissionId,
      isDeleted: true,
    },
    orderBy: {
      deletedAt: 'desc',
    },
  });

  if (revokedAssignment) {
    await prisma.rolePermission.update({
      where: { id: revokedAssignment.id },
      data: {
        isDeleted: false,
        deletedAt: null,
        assignedAt: new Date(),
        assignedById,
        revokedById: null,
      },
    });
    return;
  }

  await prisma.rolePermission.create({
    data: {
      roleId,
      permissionId,
      assignedById,
    },
  });
}

export async function seedRolePermissions(
  prisma: PrismaClient,
  roleIds: Record<string, string>,
  permissionIds: Record<string, string>,
  assignedById?: string,
): Promise<void> {
  let assignedCount = 0;

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSION_MAP)) {
    const roleId = roleIds[roleName];

    if (!roleId) {
      continue;
    }

    for (const permissionName of permissionNames) {
      const permissionId = permissionIds[permissionName];

      if (!permissionId) {
        continue;
      }

      await ensureRolePermission(prisma, roleId, permissionId, assignedById);
      assignedCount += 1;
    }
  }

  console.log(
    `Role permissions seed completed. Assignments ensured: ${assignedCount}.`,
  );
}

export async function seedRbacPermissions(
  prisma: PrismaClient,
  roleIds: Record<string, string>,
  assignedById?: string,
): Promise<void> {
  const permissionIds = await seedPermissions(prisma);
  await seedRolePermissions(prisma, roleIds, permissionIds, assignedById);
}
