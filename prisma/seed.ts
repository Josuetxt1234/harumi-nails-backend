import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_PERMISSION_MAP,
} from '../src/common/constants/permissions.constants';

const prisma = new PrismaClient();

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MESA'] as const;

type SeedUser = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: (typeof ROLES)[number];
};

const SEED_USERS: SeedUser[] = [
  {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@haruminails.com',
    password: 'SuperAdmin123!',
    phone: '0990000001',
    role: 'SUPER_ADMIN',
  },
  {
    firstName: 'Laura',
    lastName: 'Harumi',
    email: 'admin@haruminails.com',
    password: 'Admin123!',
    phone: '0990000002',
    role: 'ADMIN',
  },
  {
    firstName: 'Maria',
    lastName: 'Lopez',
    email: 'mesa1@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001001',
    role: 'MESA',
  },
  {
    firstName: 'Ana',
    lastName: 'Torres',
    email: 'mesa2@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001002',
    role: 'MESA',
  },
  {
    firstName: 'Sofia',
    lastName: 'Ruiz',
    email: 'mesa3@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001003',
    role: 'MESA',
  },
  {
    firstName: 'Camila',
    lastName: 'Vargas',
    email: 'mesa4@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001004',
    role: 'MESA',
  },
  {
    firstName: 'Valentina',
    lastName: 'Mora',
    email: 'mesa5@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001005',
    role: 'MESA',
  },
  {
    firstName: 'Daniela',
    lastName: 'Paredes',
    email: 'mesa6@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001006',
    role: 'MESA',
  },
  {
    firstName: 'Isabella',
    lastName: 'Castillo',
    email: 'mesa7@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001007',
    role: 'MESA',
  },
  {
    firstName: 'Fernanda',
    lastName: 'Salazar',
    email: 'mesa8@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001008',
    role: 'MESA',
  },
  {
    firstName: 'Paula',
    lastName: 'Mendez',
    email: 'mesa9@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001009',
    role: 'MESA',
  },
  {
    firstName: 'Gabriela',
    lastName: 'Rios',
    email: 'mesa10@haruminails.com',
    password: 'Mesa1234!',
    phone: '0990001010',
    role: 'MESA',
  },
];

async function seedRoles(): Promise<Record<string, string>> {
  const roleIds: Record<string, string> = {};

  for (const roleName of ROLES) {
    const existingRole = await prisma.role.findFirst({
      where: {
        name: roleName,
        isDeleted: false,
      },
    });

    if (existingRole) {
      roleIds[roleName] = existingRole.id;
      continue;
    }

    const role = await prisma.role.create({
      data: {
        name: roleName,
        description: `${roleName.replace('_', ' ')} role`,
      },
    });

    roleIds[roleName] = role.id;
    console.log(`Role created: ${roleName}`);
  }

  return roleIds;
}

async function ensureUserRole(
  userId: string,
  roleId: string,
  assignedById: string,
): Promise<void> {
  const activeAssignment = await prisma.userRole.findFirst({
    where: {
      userId,
      roleId,
      isDeleted: false,
    },
  });

  if (activeAssignment) {
    return;
  }

  const revokedAssignment = await prisma.userRole.findFirst({
    where: {
      userId,
      roleId,
      isDeleted: true,
    },
    orderBy: {
      deletedAt: 'desc',
    },
  });

  if (revokedAssignment) {
    await prisma.userRole.update({
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

  await prisma.userRole.create({
    data: {
      userId,
      roleId,
      assignedById,
    },
  });
}

async function seedUsers(roleIds: Record<string, string>): Promise<string | undefined> {
  let createdCount = 0;
  let skippedCount = 0;
  let auditorUserId: string | undefined;

  for (const seedUser of SEED_USERS) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: seedUser.email,
        isDeleted: false,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      if (!auditorUserId) {
        auditorUserId = existingUser.id;
      }

      await ensureUserRole(
        existingUser.id,
        roleIds[seedUser.role],
        auditorUserId,
      );
      skippedCount += 1;
      console.log(`User already exists. Skipping: ${seedUser.email}`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(seedUser.password, 12);

    const createdUser = await prisma.user.create({
      data: {
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        email: seedUser.email,
        phone: seedUser.phone,
        password: hashedPassword,
        isActive: true,
        createdById: auditorUserId,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!auditorUserId) {
      auditorUserId = createdUser.id;
    }

    await ensureUserRole(
      createdUser.id,
      roleIds[seedUser.role],
      auditorUserId,
    );

    createdCount += 1;
    console.log(
      `User created: ${seedUser.email} (${seedUser.role}) / password: ${seedUser.password}`,
    );
  }

  console.log(
    `User seed completed. Created: ${createdCount}. Skipped: ${skippedCount}.`,
  );

  return auditorUserId;
}

async function seedPermissions(): Promise<Record<string, string>> {
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
      console.log(`Permission reactivated: ${permissionName}`);
      continue;
    }

    const permission = await prisma.permission.create({
      data: {
        name: permissionName,
        description: PERMISSION_DESCRIPTIONS[permissionName],
      },
    });

    permissionIds[permissionName] = permission.id;
    console.log(`Permission created: ${permissionName}`);
  }

  return permissionIds;
}

async function ensureRolePermission(
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

async function seedRolePermissions(
  roleIds: Record<string, string>,
  permissionIds: Record<string, string>,
  assignedById?: string,
): Promise<void> {
  let assignedCount = 0;

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSION_MAP)) {
    const roleId = roleIds[roleName];

    if (!roleId) {
      console.warn(`Role not found for permission seeding: ${roleName}`);
      continue;
    }

    for (const permissionName of permissionNames) {
      const permissionId = permissionIds[permissionName];

      if (!permissionId) {
        console.warn(`Permission not found: ${permissionName}`);
        continue;
      }

      await ensureRolePermission(roleId, permissionId, assignedById);
      assignedCount += 1;
    }
  }

  console.log(`Role permissions seed completed. Assignments ensured: ${assignedCount}.`);
}

type SeedService = {
  name: string;
  category: string;
  price: number;
  commissionPercentage: number;
};

const SEED_SERVICES: SeedService[] = [
  {
    name: 'Manicure clásico',
    category: 'Uñas',
    price: 12.0,
    commissionPercentage: 50,
  },
  {
    name: 'Esmaltado semipermanente',
    category: 'Uñas',
    price: 18.0,
    commissionPercentage: 50,
  },
  {
    name: 'Uñas acrílicas',
    category: 'Uñas',
    price: 35.0,
    commissionPercentage: 50,
  },
  {
    name: 'Retoque de acrílico',
    category: 'Uñas',
    price: 22.0,
    commissionPercentage: 50,
  },
  {
    name: 'Extensión de pestañas clásica',
    category: 'Pestañas',
    price: 40.0,
    commissionPercentage: 50,
  },
  {
    name: 'Lifting de pestañas',
    category: 'Pestañas',
    price: 28.0,
    commissionPercentage: 50,
  },
  {
    name: 'Depilación de cejas',
    category: 'Depilación',
    price: 8.0,
    commissionPercentage: 50,
  },
  {
    name: 'Depilación de bozo',
    category: 'Depilación',
    price: 6.0,
    commissionPercentage: 50,
  },
];

async function seedServices(createdById?: string): Promise<void> {
  let createdCount = 0;
  let skippedCount = 0;

  for (const seedService of SEED_SERVICES) {
    const existingService = await prisma.service.findFirst({
      where: {
        name: seedService.name,
        isDeleted: false,
      },
    });

    if (existingService) {
      skippedCount += 1;
      console.log(`Service already exists. Skipping: ${seedService.name}`);
      continue;
    }

    await prisma.service.create({
      data: {
        name: seedService.name,
        category: seedService.category,
        price: seedService.price,
        commissionPercentage: seedService.commissionPercentage,
        isActive: true,
        createdById,
      },
    });

    createdCount += 1;
    console.log(
      `Service created: ${seedService.name} (${seedService.category}) - $${seedService.price}`,
    );
  }

  console.log(
    `Services seed completed. Created: ${createdCount}. Skipped: ${skippedCount}.`,
  );
}

async function main(): Promise<void> {
  const roleIds = await seedRoles();
  const auditorUserId = await seedUsers(roleIds);
  const permissionIds = await seedPermissions();
  await seedRolePermissions(roleIds, permissionIds, auditorUserId);
  await seedServices(auditorUserId);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
