import {
  AdvanceStatus,
  CatalogStatus,
  InventoryMovementType,
  MaterialUnit,
  PaymentMethod,
  PayrollStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_SALON_TIMEZONE,
  getCalendarDateInTimeZone,
  getSalonPayrollWeekRange,
  zonedCivilTimeToUtc,
} from '../src/common/utils/date.util';
import { toMoney } from '../src/common/utils/money.util';
import { calculatePayrollTotals } from '../src/modules/payroll/payroll-calculator';
import { seedRbacPermissions } from './seed-role-permissions';

const prisma = new PrismaClient();
const TZ = DEFAULT_SALON_TIMEZONE;
const CARD_FEE_RATE = 0.05;
const COMMISSION_PERCENTAGE = 50;
const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MESA'] as const;

/** Demo credentials. Re-running the seed resets these accounts to these values. */
const SUPER_ADMIN = {
  firstName: 'Super',
  lastName: 'Admin',
  email: 'superadmin@haruminails.com',
  password: 'Harumi.Super.2026!',
  phone: '0990000001',
  role: 'SUPER_ADMIN' as const,
};

const ADMIN = {
  firstName: 'Laura',
  lastName: 'Harumi',
  email: 'admin@haruminails.com',
  password: 'Harumi.Admin.2026!',
  phone: '0990000002',
  role: 'ADMIN' as const,
};

const MESA_PASSWORD = 'Harumi.Mesa.2026!';

const MESA_PROFILES = [
  { firstName: 'Maria', lastName: 'Lopez', email: 'mesa1@haruminails.com' },
  { firstName: 'Ana', lastName: 'Torres', email: 'mesa2@haruminails.com' },
  { firstName: 'Sofia', lastName: 'Ruiz', email: 'mesa3@haruminails.com' },
  { firstName: 'Camila', lastName: 'Vargas', email: 'mesa4@haruminails.com' },
  { firstName: 'Valentina', lastName: 'Mora', email: 'mesa5@haruminails.com' },
  { firstName: 'Daniela', lastName: 'Paredes', email: 'mesa6@haruminails.com' },
  { firstName: 'Isabella', lastName: 'Castillo', email: 'mesa7@haruminails.com' },
  { firstName: 'Fernanda', lastName: 'Salazar', email: 'mesa8@haruminails.com' },
  { firstName: 'Paula', lastName: 'Mendez', email: 'mesa9@haruminails.com' },
  { firstName: 'Gabriela', lastName: 'Rios', email: 'mesa10@haruminails.com' },
];

type OfficialService = {
  name: string;
  category: string;
  price: number;
  description: string;
};

const OFFICIAL_SERVICES: OfficialService[] = [
  {
    category: 'MANICURE',
    name: 'Manicure nivelación de uñas',
    price: 20,
    description:
      'Manicure rusa, velo terapia hidratante y aplicación de esmalte semipermanente.',
  },
  {
    category: 'MANICURE',
    name: 'Manicure Rusa con esmaltado en gel',
    price: 18,
    description:
      'Incluye manicure rusa, velo terapia hidratante y aplicación de esmalte semipermanente.',
  },
  {
    category: 'MANICURE',
    name: 'Manicure con Base Rubber',
    price: 15,
    description:
      'Manicure combinada, aceite de cutícula, crema hidratante o velo terapia hidratante.',
  },
  {
    category: 'MANICURE',
    name: 'Manicure en Gel básico',
    price: 12,
    description:
      'Manicure combinada, aceite de cutícula, acabado profesional y crema hidratante.',
  },
  {
    category: 'MANICURE',
    name: 'Manicure clásica (tradicional)',
    price: 10,
    description: 'Limpieza de cutículas, limado y acabado profesional.',
  },
  {
    category: 'EXTENSIONES DE UÑAS',
    name: 'Esculpidas en polygel',
    price: 35,
    description:
      'Sistema flexible y duradero con apariencia natural. Hasta #2 (cotizar diseño).',
  },
  {
    category: 'EXTENSIONES DE UÑAS',
    name: 'Sistema dual o sanduche',
    price: 30,
    description: 'Acabado natural, ligero y elegante (cotizar diseño).',
  },
  {
    category: 'EXTENSIONES DE UÑAS',
    name: 'Esculpidas en Acrílicas',
    price: 30,
    description:
      'Extensión resistente con diseño personalizado. Hasta #2 (cotizar diseño).',
  },
  {
    category: 'EXTENSIONES DE UÑAS',
    name: 'Polygel',
    price: 25,
    description:
      'Sistema flexible y duradero con apariencia natural. Hasta #2 (cotizar diseño).',
  },
  {
    category: 'EXTENSIONES DE UÑAS',
    name: 'Acrílicas Clásicas',
    price: 22,
    description:
      'Extensión resistente con diseño personalizado. Hasta #2 (cotizar diseño).',
  },
  {
    category: 'EXTENSIONES DE UÑAS',
    name: 'Recubrimiento en Uña Natural Acrílico',
    price: 20,
    description: 'Refuerzo para uñas naturales sin extensión (cotizar diseño).',
  },
  {
    category: 'EXTENSIONES DE UÑAS',
    name: 'Sof gel',
    price: 20,
    description: 'Hasta #4 (cotizar diseño).',
  },
];

const CLIENTS = [
  'Ana Pérez',
  'Lucía Mora',
  'Carmen Díaz',
  'Elena Vargas',
  'Rosa Mendoza',
  'Patricia León',
];

const INVENTORY = [
  {
    category: 'Acrílico',
    code: 'ACR-POWDER',
    name: 'Polvo acrílico',
    unit: MaterialUnit.GRAMS,
    stock: 500,
    minimum: 100,
    cost: 18,
  },
  {
    category: 'Polygel',
    code: 'POLYGEL-CLR',
    name: 'Polygel clear',
    unit: MaterialUnit.GRAMS,
    stock: 250,
    minimum: 50,
    cost: 22,
  },
  {
    category: 'Esmaltes',
    code: 'ESM-NUDE',
    name: 'Esmalte semipermanente nude',
    unit: MaterialUnit.UNIT,
    stock: 24,
    minimum: 6,
    cost: 8,
  },
  {
    category: 'Cuidado de cutícula',
    code: 'OIL-CUT',
    name: 'Aceite de cutícula',
    unit: MaterialUnit.ML,
    stock: 300,
    minimum: 60,
    cost: 6,
  },
  {
    category: 'Cuidado de cutícula',
    code: 'CREAM-HID',
    name: 'Crema hidratante',
    unit: MaterialUnit.ML,
    stock: 400,
    minimum: 80,
    cost: 7,
  },
  {
    category: 'Polygel',
    code: 'RUBBER-BASE',
    name: 'Base rubber',
    unit: MaterialUnit.ML,
    stock: 180,
    minimum: 40,
    cost: 12,
  },
  {
    category: 'Polygel',
    code: 'SOFT-GEL',
    name: 'Soft gel',
    unit: MaterialUnit.ML,
    stock: 160,
    minimum: 40,
    cost: 14,
  },
  {
    category: 'Extensiones',
    code: 'DUAL-TIP',
    name: 'Tips sistema dual',
    unit: MaterialUnit.PAIR,
    stock: 80,
    minimum: 20,
    cost: 4,
  },
] as const;

type CalendarDate = { year: number; month: number; day: number };

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function atSalon(weekStart: Date, dayOffset: number, hour: number): Date {
  const saturday = getCalendarDateInTimeZone(weekStart, TZ);
  const day = addCalendarDays(saturday, dayOffset);
  return zonedCivilTimeToUtc(day.year, day.month, day.day, hour, 15, 0, 0, TZ);
}

function shiftWeek(range: { start: Date; end: Date }, weeks: number) {
  const ms = weeks * 7 * 24 * 60 * 60 * 1000;
  return {
    start: new Date(range.start.getTime() + ms),
    end: new Date(range.end.getTime() + ms),
  };
}

async function seedRoles(): Promise<Record<string, string>> {
  const roleIds: Record<string, string> = {};

  for (const roleName of ROLES) {
    const existing = await prisma.role.findFirst({
      where: { name: roleName, isDeleted: false },
    });
    if (existing) {
      roleIds[roleName] = existing.id;
      continue;
    }
    const created = await prisma.role.create({
      data: {
        name: roleName,
        description: `${roleName.replaceAll('_', ' ')} role`,
      },
    });
    roleIds[roleName] = created.id;
  }

  return roleIds;
}

async function ensureUserRole(
  userId: string,
  roleId: string,
  assignedById: string,
): Promise<void> {
  const active = await prisma.userRole.findFirst({
    where: { userId, roleId, isDeleted: false },
  });
  if (active) {
    return;
  }

  await prisma.userRole.create({
    data: { userId, roleId, assignedById },
  });
}

async function upsertAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  roleId: string;
  createdById?: string;
}): Promise<string> {
  const password = await bcrypt.hash(input.password, 12);
  const existing = await prisma.user.findFirst({
    where: { email: input.email, isDeleted: false },
  });

  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    password,
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    mustChangePassword: false,
  };

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : await prisma.user.create({
        data: {
          ...data,
          email: input.email,
          createdById: input.createdById,
        },
      });

  await ensureUserRole(user.id, input.roleId, user.id);
  return user.id;
}

async function replaceOfficialServices(actorId: string): Promise<
  Array<{ id: string; price: number; commissionPercentage: number }>
> {
  const officialNames = OFFICIAL_SERVICES.map((service) => service.name);

  await prisma.service.updateMany({
    where: {
      name: { notIn: officialNames },
      isDeleted: false,
    },
    data: {
      isDeleted: true,
      isActive: false,
      deletedAt: new Date(),
      deletedById: actorId,
    },
  });

  const saved: Array<{ id: string; price: number; commissionPercentage: number }> =
    [];

  for (const service of OFFICIAL_SERVICES) {
    const existing = await prisma.service.findFirst({
      where: { name: service.name },
      orderBy: { createdAt: 'asc' },
    });

    const payload = {
      category: service.category,
      description: service.description,
      price: new Prisma.Decimal(service.price.toFixed(2)),
      commissionPercentage: new Prisma.Decimal(COMMISSION_PERCENTAGE.toFixed(2)),
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      updatedById: actorId,
    };

    const row = existing
      ? await prisma.service.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.service.create({
          data: {
            ...payload,
            name: service.name,
            createdById: actorId,
          },
        });

    saved.push({
      id: row.id,
      price: service.price,
      commissionPercentage: COMMISSION_PERCENTAGE,
    });
  }

  return saved;
}

async function clearMesaOperations(mesaIds: string[]): Promise<void> {
  await prisma.dailyRegister.deleteMany({
    where: { mesaUserId: { in: mesaIds } },
  });
  await prisma.advance.deleteMany({
    where: { mesaUserId: { in: mesaIds } },
  });
  await prisma.payroll.deleteMany({
    where: { mesaUserId: { in: mesaIds } },
  });
}

async function createTicket(input: {
  mesaUserId: string;
  adminId: string;
  service: { id: string; price: number; commissionPercentage: number };
  clientName: string;
  paymentMethod: PaymentMethod;
  hasCardFee: boolean;
  createdAt: Date;
}): Promise<void> {
  const unitPrice = toMoney(input.service.price);
  const lineSubtotal = unitPrice;
  const lineCommission = toMoney(
    unitPrice * (input.service.commissionPercentage / 100),
  );
  const cardFeeAmount =
    input.paymentMethod === PaymentMethod.CARD && input.hasCardFee
      ? toMoney(lineSubtotal * CARD_FEE_RATE)
      : 0;
  const totalPaid = toMoney(lineSubtotal + cardFeeAmount);

  await prisma.dailyRegister.create({
    data: {
      clientName: input.clientName,
      paymentMethod: input.paymentMethod,
      subtotalBase: new Prisma.Decimal(lineSubtotal.toFixed(2)),
      discountAmount: new Prisma.Decimal('0.00'),
      cardFeeAmount: new Prisma.Decimal(cardFeeAmount.toFixed(2)),
      totalPaid: new Prisma.Decimal(totalPaid.toFixed(2)),
      totalCommission: new Prisma.Decimal(lineCommission.toFixed(2)),
      mesaUserId: input.mesaUserId,
      createdById: input.adminId,
      createdAt: input.createdAt,
      details: {
        create: {
          serviceId: input.service.id,
          unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
          commissionRate: new Prisma.Decimal(
            input.service.commissionPercentage.toFixed(2),
          ),
          quantity: 1,
          lineSubtotal: new Prisma.Decimal(lineSubtotal.toFixed(2)),
          lineCommission: new Prisma.Decimal(lineCommission.toFixed(2)),
        },
      },
    },
  });
}

async function seedOperations(
  adminId: string,
  mesaIds: string[],
  services: Array<{ id: string; price: number; commissionPercentage: number }>,
): Promise<void> {
  await clearMesaOperations(mesaIds);

  const current = getSalonPayrollWeekRange(TZ);
  const weeks = {
    [-2]: shiftWeek(current, -2),
    [-1]: shiftWeek(current, -1),
    0: current,
  };

  const methods = [PaymentMethod.CASH, PaymentMethod.TRANSFER, PaymentMethod.CARD];

  for (const [mesaIndex, mesaUserId] of mesaIds.entries()) {
    for (const weekOffset of [-2, -1, 0] as const) {
      for (let slot = 0; slot < 3; slot += 1) {
        const service =
          services[(mesaIndex + slot + (weekOffset === 0 ? 2 : 0)) % services.length];
        const method = methods[(mesaIndex + slot) % methods.length];
        await createTicket({
          mesaUserId,
          adminId,
          service,
          clientName: CLIENTS[(mesaIndex + slot) % CLIENTS.length],
          paymentMethod: method,
          hasCardFee: method === PaymentMethod.CARD,
          createdAt: atSalon(weeks[weekOffset].start, slot === 2 ? 6 : slot * 2, 10 + slot),
        });
      }
    }
  }

  const advancePlan: Array<{
    mesaIndex: number;
    week: -2 | -1 | 0;
    amount: number;
    status: 'apply' | 'pending' | 'cancelled';
    reason: string;
  }> = [
    { mesaIndex: 0, week: -2, amount: 15, status: 'apply', reason: 'Adelanto liquidado semana anterior' },
    { mesaIndex: 2, week: -2, amount: 20, status: 'apply', reason: 'Adelanto liquidado materiales' },
    { mesaIndex: 4, week: -1, amount: 10, status: 'apply', reason: 'Adelanto liquidado personal' },
    { mesaIndex: 1, week: 0, amount: 12, status: 'pending', reason: 'Vale pendiente semana actual' },
    { mesaIndex: 3, week: 0, amount: 18, status: 'pending', reason: 'Vale pendiente semana actual' },
    { mesaIndex: 5, week: 0, amount: 8, status: 'cancelled', reason: 'Vale anulado por error de caja' },
  ];

  for (const plan of advancePlan) {
    const date = atSalon(weeks[plan.week].start, 2, 9);
    await prisma.advance.create({
      data: {
        mesaUserId: mesaIds[plan.mesaIndex],
        amount: new Prisma.Decimal(plan.amount.toFixed(2)),
        reason: plan.reason,
        date,
        status:
          plan.status === 'cancelled'
            ? AdvanceStatus.CANCELLED
            : AdvanceStatus.PENDING,
        createdById: adminId,
        cancellationReason:
          plan.status === 'cancelled' ? 'Registrado por error' : null,
        cancelledAt: plan.status === 'cancelled' ? date : null,
        cancelledByUserId: plan.status === 'cancelled' ? adminId : null,
      },
    });
  }

  for (const weekOffset of [-2, -1] as const) {
    const week = weeks[weekOffset];
    for (const mesaUserId of mesaIds) {
      const registers = await prisma.dailyRegister.findMany({
        where: {
          mesaUserId,
          isDeleted: false,
          payrollId: null,
          createdAt: { gte: week.start, lte: week.end },
        },
        select: {
          id: true,
          createdAt: true,
          totalPaid: true,
          details: { select: { lineSubtotal: true, lineCommission: true } },
        },
      });
      const advances = await prisma.advance.findMany({
        where: {
          mesaUserId,
          isDeleted: false,
          status: AdvanceStatus.PENDING,
          date: { lte: week.end },
        },
        select: { id: true, amount: true },
      });
      const totals = calculatePayrollTotals(registers, advances, TZ);
      const payroll = await prisma.payroll.create({
        data: {
          mesaUserId,
          periodStart: week.start,
          periodEnd: week.end,
          grossSales: new Prisma.Decimal(totals.grossSales.toFixed(2)),
          baseCommissionTotal: new Prisma.Decimal(
            totals.baseCommissionTotal.toFixed(2),
          ),
          weekendBonusTotal: new Prisma.Decimal(
            totals.weekendBonusTotal.toFixed(2),
          ),
          advancesDeductionTotal: new Prisma.Decimal(
            totals.advancesDeductionTotal.toFixed(2),
          ),
          netPayable: new Prisma.Decimal(totals.netPayable.toFixed(2)),
          status: PayrollStatus.CLOSED,
          closedAt: week.end,
          closedById: adminId,
        },
      });

      if (totals.registerIds.length > 0) {
        await prisma.dailyRegister.updateMany({
          where: { id: { in: totals.registerIds } },
          data: { payrollId: payroll.id },
        });
      }
      if (totals.advanceIds.length > 0) {
        await prisma.advance.updateMany({
          where: { id: { in: totals.advanceIds } },
          data: { status: AdvanceStatus.APPLIED, payrollId: payroll.id },
        });
      }
    }
  }
}

async function seedInventory(actorId: string): Promise<void> {
  const categoryIds = new Map<string, string>();

  for (const item of INVENTORY) {
    if (categoryIds.has(item.category)) {
      continue;
    }
    const existing = await prisma.inventoryCategory.findUnique({
      where: { name: item.category },
    });
    const category = existing
      ? await prisma.inventoryCategory.update({
          where: { id: existing.id },
          data: { status: CatalogStatus.ACTIVE, updatedById: actorId },
        })
      : await prisma.inventoryCategory.create({
          data: {
            name: item.category,
            description: `Insumos de ${item.category.toLowerCase()}`,
            status: CatalogStatus.ACTIVE,
            createdById: actorId,
          },
        });
    categoryIds.set(item.category, category.id);
  }

  for (const item of INVENTORY) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) {
      continue;
    }

    const existing = await prisma.material.findUnique({
      where: { code: item.code },
    });
    const material = existing
      ? await prisma.material.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            categoryId,
            unit: item.unit,
            minimumStock: new Prisma.Decimal(item.minimum.toFixed(2)),
            costPrice: new Prisma.Decimal(item.cost.toFixed(2)),
            status: CatalogStatus.ACTIVE,
            updatedById: actorId,
          },
        })
      : await prisma.material.create({
          data: {
            code: item.code,
            name: item.name,
            categoryId,
            unit: item.unit,
            currentStock: new Prisma.Decimal('0.00'),
            minimumStock: new Prisma.Decimal(item.minimum.toFixed(2)),
            costPrice: new Prisma.Decimal(item.cost.toFixed(2)),
            status: CatalogStatus.ACTIVE,
            createdById: actorId,
          },
        });

    const movements = await prisma.inventoryMovement.count({
      where: { materialId: material.id },
    });
    if (movements > 0) {
      continue;
    }

    const quantity = toMoney(item.stock);
    await prisma.inventoryMovement.create({
      data: {
        materialId: material.id,
        type: InventoryMovementType.IN,
        quantity: new Prisma.Decimal(quantity.toFixed(2)),
        previousStock: new Prisma.Decimal('0.00'),
        newStock: new Prisma.Decimal(quantity.toFixed(2)),
        reason: 'Carga inicial del catálogo',
        createdById: actorId,
      },
    });
    await prisma.material.update({
      where: { id: material.id },
      data: { currentStock: new Prisma.Decimal(quantity.toFixed(2)) },
    });
  }
}

function printCredentials(): void {
  console.log('\nCredenciales de acceso (mustChangePassword = false):');
  console.log(`  SUPER_ADMIN  ${SUPER_ADMIN.email}  ${SUPER_ADMIN.password}`);
  console.log(`  ADMIN        ${ADMIN.email}  ${ADMIN.password}`);
  console.log(`  MESA         mesa1@haruminails.com … mesa10@haruminails.com  ${MESA_PASSWORD}`);
}

async function main(): Promise<void> {
  const roleIds = await seedRoles();
  const superAdminId = await upsertAccount({
    ...SUPER_ADMIN,
    roleId: roleIds.SUPER_ADMIN,
  });
  const adminId = await upsertAccount({
    ...ADMIN,
    roleId: roleIds.ADMIN,
    createdById: superAdminId,
  });

  const mesaIds: string[] = [];
  for (const [index, profile] of MESA_PROFILES.entries()) {
    const id = await upsertAccount({
      ...profile,
      password: MESA_PASSWORD,
      phone: `09900010${String(index + 1).padStart(2, '0')}`,
      roleId: roleIds.MESA,
      createdById: adminId,
    });
    mesaIds.push(id);
  }

  await seedRbacPermissions(prisma, roleIds, superAdminId);
  const services = await replaceOfficialServices(adminId);
  await seedOperations(adminId, mesaIds, services);
  await seedInventory(adminId);

  console.log('Seed unificado completado.');
  console.log(`Servicios oficiales: ${services.length}. Mesas: ${mesaIds.length}.`);
  printCredentials();
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
