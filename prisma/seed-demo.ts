import {
  AdvanceStatus,
  PaymentMethod,
  PayrollStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  getCalendarDateInTimeZone,
  getSalonPayrollWeekRange,
  zonedCivilTimeToUtc,
} from '../src/common/utils/date.util';
import { toMoney } from '../src/common/utils/money.util';
import { calculatePayrollTotals } from '../src/modules/payroll/payroll-calculator';

const prisma = new PrismaClient();
const TZ = 'America/Guayaquil';
const DEMO_PASSWORD = 'Admin1234*';
const CARD_FEE_RATE = 0.05;

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MESA'] as const;

type DemoUser = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: (typeof ROLES)[number];
  key?: 'gabriela' | 'valeria' | 'sofia';
};

const DEMO_USERS: DemoUser[] = [
  {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@harumi.com',
    phone: '0991110001',
    role: 'SUPER_ADMIN',
  },
  {
    firstName: 'Laura',
    lastName: 'Harumi',
    email: 'admin@harumi.com',
    phone: '0991110002',
    role: 'ADMIN',
  },
  {
    firstName: 'Gabriela',
    lastName: 'Ríos',
    email: 'gabriela.rios@harumi.com',
    phone: '0991111001',
    role: 'MESA',
    key: 'gabriela',
  },
  {
    firstName: 'Valeria',
    lastName: 'Gómez',
    email: 'valeria.gomez@harumi.com',
    phone: '0991111002',
    role: 'MESA',
    key: 'valeria',
  },
  {
    firstName: 'Sofia',
    lastName: 'Morales',
    email: 'sofia.morales@harumi.com',
    phone: '0991111003',
    role: 'MESA',
    key: 'sofia',
  },
];

const DEMO_SERVICES = [
  {
    key: 'acrilicas',
    name: 'Uñas Acrílicas Esculpidas',
    category: 'Uñas',
    price: 35,
    commissionPercentage: 50,
  },
  {
    key: 'rusa',
    name: 'Manicura Rusa',
    category: 'Manicura',
    price: 20,
    commissionPercentage: 45,
  },
  {
    key: 'pedicura',
    name: 'Pedicura Spa',
    category: 'Pedicura',
    price: 25,
    commissionPercentage: 40,
  },
  {
    key: 'gel',
    name: 'Baño de Gel',
    category: 'Uñas',
    price: 18,
    commissionPercentage: 50,
  },
  {
    key: 'semi',
    name: 'Esmaltado Semipermanente',
    category: 'Uñas',
    price: 15,
    commissionPercentage: 50,
  },
  {
    key: 'retiro',
    name: 'Retiro de Sistema',
    category: 'Uñas',
    price: 8,
    commissionPercentage: 30,
  },
  {
    key: 'encapsulado',
    name: 'Encapsulado por Uña',
    category: 'Uñas',
    price: 3,
    commissionPercentage: 50,
  },
  {
    key: 'art',
    name: 'Nail Art Avanzado',
    category: 'Nail Art',
    price: 10,
    commissionPercentage: 50,
  },
] as const;

type ServiceKey = (typeof DEMO_SERVICES)[number]['key'];
type MesaKey = 'gabriela' | 'valeria' | 'sofia';

type TicketSpec = {
  weekOffset: -2 | -1 | 0;
  dayOffset: number;
  hour: number;
  mesa: MesaKey;
  clientName: string;
  paymentMethod: PaymentMethod;
  discount?: number;
  hasCardFee?: boolean;
  items: Array<{ service: ServiceKey; quantity: number }>;
};

const TICKETS: TicketSpec[] = [
  { weekOffset: -2, dayOffset: 0, hour: 10, mesa: 'gabriela', clientName: 'Carolina Pérez', paymentMethod: 'CARD', hasCardFee: true, items: [{ service: 'acrilicas', quantity: 1 }, { service: 'art', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 0, hour: 14, mesa: 'valeria', clientName: 'Andrea Molina', paymentMethod: 'CASH', items: [{ service: 'gel', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 1, hour: 11, mesa: 'sofia', clientName: 'Lucía Herrera', paymentMethod: 'TRANSFER', discount: 3, items: [{ service: 'rusa', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 1, hour: 16, mesa: 'gabriela', clientName: 'Paola Jiménez', paymentMethod: 'CASH', items: [{ service: 'semi', quantity: 1 }, { service: 'art', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 2, hour: 12, mesa: 'valeria', clientName: 'Elena Castro', paymentMethod: 'CARD', hasCardFee: true, items: [{ service: 'pedicura', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 3, hour: 10, mesa: 'gabriela', clientName: 'Natalia Vega', paymentMethod: 'TRANSFER', items: [{ service: 'retiro', quantity: 1 }, { service: 'acrilicas', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 4, hour: 13, mesa: 'sofia', clientName: 'Mariana Ortiz', paymentMethod: 'CASH', discount: 2, items: [{ service: 'semi', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 5, hour: 11, mesa: 'gabriela', clientName: 'Daniela Flores', paymentMethod: 'CASH', items: [{ service: 'encapsulado', quantity: 4 }] },
  { weekOffset: -2, dayOffset: 5, hour: 15, mesa: 'valeria', clientName: 'Rosa Cevallos', paymentMethod: 'TRANSFER', items: [{ service: 'rusa', quantity: 1 }, { service: 'art', quantity: 1 }] },
  { weekOffset: -2, dayOffset: 6, hour: 17, mesa: 'gabriela', clientName: 'Fernanda León', paymentMethod: 'CARD', hasCardFee: true, discount: 5, items: [{ service: 'pedicura', quantity: 1 }] },

  { weekOffset: -1, dayOffset: 0, hour: 10, mesa: 'valeria', clientName: 'Camila Andrade', paymentMethod: 'CASH', items: [{ service: 'acrilicas', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 0, hour: 15, mesa: 'gabriela', clientName: 'Isabel Romero', paymentMethod: 'TRANSFER', items: [{ service: 'gel', quantity: 1 }, { service: 'art', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 1, hour: 12, mesa: 'valeria', clientName: 'Gabriela Soto', paymentMethod: 'CARD', hasCardFee: true, items: [{ service: 'rusa', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 1, hour: 16, mesa: 'sofia', clientName: 'Verónica Salas', paymentMethod: 'CASH', discount: 4, items: [{ service: 'pedicura', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 2, hour: 11, mesa: 'valeria', clientName: 'Patricia Núñez', paymentMethod: 'TRANSFER', items: [{ service: 'semi', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 3, hour: 13, mesa: 'gabriela', clientName: 'Alejandra Ponce', paymentMethod: 'CASH', items: [{ service: 'retiro', quantity: 1 }, { service: 'gel', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 4, hour: 10, mesa: 'valeria', clientName: 'Monica Bravo', paymentMethod: 'CARD', hasCardFee: true, discount: 2, items: [{ service: 'acrilicas', quantity: 1 }, { service: 'encapsulado', quantity: 2 }] },
  { weekOffset: -1, dayOffset: 5, hour: 14, mesa: 'sofia', clientName: 'Karla Espinoza', paymentMethod: 'CASH', items: [{ service: 'art', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 5, hour: 17, mesa: 'valeria', clientName: 'Diana Cabrera', paymentMethod: 'TRANSFER', items: [{ service: 'pedicura', quantity: 1 }] },
  { weekOffset: -1, dayOffset: 6, hour: 11, mesa: 'valeria', clientName: 'Stephanie Rivas', paymentMethod: 'CASH', items: [{ service: 'semi', quantity: 1 }, { service: 'art', quantity: 1 }] },

  { weekOffset: 0, dayOffset: 0, hour: 10, mesa: 'sofia', clientName: 'Melissa Aguirre', paymentMethod: 'CARD', hasCardFee: true, items: [{ service: 'acrilicas', quantity: 1 }] },
  { weekOffset: 0, dayOffset: 0, hour: 16, mesa: 'gabriela', clientName: 'Paula Mendoza', paymentMethod: 'CASH', items: [{ service: 'rusa', quantity: 1 }, { service: 'art', quantity: 1 }] },
  { weekOffset: 0, dayOffset: 1, hour: 12, mesa: 'valeria', clientName: 'Nicole Zambrano', paymentMethod: 'TRANSFER', discount: 3, items: [{ service: 'gel', quantity: 1 }] },
  { weekOffset: 0, dayOffset: 1, hour: 15, mesa: 'sofia', clientName: 'Andrea Palacios', paymentMethod: 'CASH', items: [{ service: 'pedicura', quantity: 1 }] },
  { weekOffset: 0, dayOffset: 2, hour: 11, mesa: 'gabriela', clientName: 'Tatiana Guerrero', paymentMethod: 'CARD', hasCardFee: true, items: [{ service: 'semi', quantity: 1 }] },
  { weekOffset: 0, dayOffset: 3, hour: 13, mesa: 'valeria', clientName: 'Jennifer Acosta', paymentMethod: 'CASH', items: [{ service: 'retiro', quantity: 1 }, { service: 'acrilicas', quantity: 1 }] },
  { weekOffset: 0, dayOffset: 4, hour: 10, mesa: 'sofia', clientName: 'Lorena Cárdenas', paymentMethod: 'TRANSFER', items: [{ service: 'encapsulado', quantity: 5 }, { service: 'art', quantity: 1 }] },
  { weekOffset: 0, dayOffset: 4, hour: 16, mesa: 'gabriela', clientName: 'Silvia Benítez', paymentMethod: 'CASH', discount: 5, items: [{ service: 'pedicura', quantity: 1 }] },
];

function addCalendarDays(
  calendar: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const next = new Date(
    Date.UTC(calendar.year, calendar.month - 1, calendar.day + days),
  );
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function shiftWeek(
  range: { start: Date; end: Date },
  offsetWeeks: number,
): { start: Date; end: Date } {
  const ms = offsetWeeks * 7 * 24 * 60 * 60 * 1000;
  return {
    start: new Date(range.start.getTime() + ms),
    end: new Date(range.end.getTime() + ms),
  };
}

function atSalonDate(
  weekStart: Date,
  dayOffset: number,
  hour: number,
): Date {
  const saturday = getCalendarDateInTimeZone(weekStart, TZ);
  const day = addCalendarDays(saturday, dayOffset);
  return zonedCivilTimeToUtc(day.year, day.month, day.day, hour, 20, 0, 0, TZ);
}

async function ensureRoles(): Promise<Record<string, string>> {
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
      data: { name: roleName, description: `${roleName.replaceAll('_', ' ')} role` },
    });
    roleIds[roleName] = created.id;
    console.log(`Role created: ${roleName}`);
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

  const revoked = await prisma.userRole.findFirst({
    where: { userId, roleId, isDeleted: true },
    orderBy: { deletedAt: 'desc' },
  });
  if (revoked) {
    await prisma.userRole.update({
      where: { id: revoked.id },
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
    data: { userId, roleId, assignedById },
  });
}

async function upsertDemoUsers(
  roleIds: Record<string, string>,
): Promise<{
  adminId: string;
  mesas: Record<MesaKey, string>;
}> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const mesas = {} as Record<MesaKey, string>;
  let adminId = '';
  let auditorId: string | undefined;

  for (const demoUser of DEMO_USERS) {
    const existing = await prisma.user.findFirst({
      where: { email: demoUser.email, isDeleted: false },
    });

    const data = {
      firstName: demoUser.firstName,
      lastName: demoUser.lastName,
      phone: demoUser.phone,
      password: passwordHash,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
    };

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.user.create({
          data: {
            ...data,
            email: demoUser.email,
            createdById: auditorId,
          },
        });

    auditorId ??= user.id;
    if (demoUser.role === 'ADMIN' || demoUser.role === 'SUPER_ADMIN') {
      if (demoUser.role === 'ADMIN') {
        adminId = user.id;
      }
    }
    if (demoUser.key) {
      mesas[demoUser.key] = user.id;
    }

    await ensureUserRole(user.id, roleIds[demoUser.role], auditorId);
    console.log(`User ready: ${demoUser.email} (${demoUser.role})`);
  }

  if (!adminId) {
    throw new Error('Demo ADMIN was not created.');
  }

  return { adminId, mesas };
}

async function upsertServices(adminId: string): Promise<Record<ServiceKey, { id: string; price: number; commissionPercentage: number }>> {
  const map = {} as Record<
    ServiceKey,
    { id: string; price: number; commissionPercentage: number }
  >;

  for (const service of DEMO_SERVICES) {
    const existing = await prisma.service.findFirst({
      where: { name: service.name, isDeleted: false },
    });

    const payload = {
      category: service.category,
      price: new Prisma.Decimal(service.price.toFixed(2)),
      commissionPercentage: new Prisma.Decimal(
        service.commissionPercentage.toFixed(2),
      ),
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      updatedById: adminId,
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
            createdById: adminId,
          },
        });

    map[service.key] = {
      id: row.id,
      price: service.price,
      commissionPercentage: service.commissionPercentage,
    };
    console.log(`Service ready: ${service.name}`);
  }

  return map;
}

async function resetMesaOperationalData(mesaIds: string[]): Promise<void> {
  const registers = await prisma.dailyRegister.findMany({
    where: { mesaUserId: { in: mesaIds } },
    select: { id: true },
  });
  const registerIds = registers.map((row) => row.id);

  await prisma.$transaction(async (tx) => {
    if (registerIds.length) {
      await tx.dailyRegisterDetail.deleteMany({
        where: { dailyRegisterId: { in: registerIds } },
      });
      await tx.dailyRegister.updateMany({
        where: { id: { in: registerIds } },
        data: { payrollId: null },
      });
    }
    await tx.advance.updateMany({
      where: { mesaUserId: { in: mesaIds } },
      data: { payrollId: null },
    });
    await tx.dailyRegister.deleteMany({
      where: { mesaUserId: { in: mesaIds } },
    });
    await tx.advance.deleteMany({
      where: { mesaUserId: { in: mesaIds } },
    });
    await tx.payroll.deleteMany({
      where: { mesaUserId: { in: mesaIds } },
    });
  });
  console.log('Previous demo operational data cleared for Mesa 1–3.');
}

async function createTicket(
  spec: TicketSpec,
  weekStart: Date,
  mesaId: string,
  adminId: string,
  services: Record<ServiceKey, { id: string; price: number; commissionPercentage: number }>,
): Promise<string> {
  const details = spec.items.map((item) => {
    const service = services[item.service];
    const lineSubtotal = toMoney(service.price * item.quantity);
    const lineCommission = toMoney(
      service.price * item.quantity * (service.commissionPercentage / 100),
    );
    return {
      serviceId: service.id,
      unitPrice: service.price,
      commissionRate: service.commissionPercentage,
      quantity: item.quantity,
      lineSubtotal,
      lineCommission,
    };
  });

  const subtotalBase = toMoney(
    details.reduce((sum, detail) => sum + detail.lineSubtotal, 0),
  );
  const discountAmount = toMoney(spec.discount ?? 0);
  const amountAfterDiscount = toMoney(subtotalBase - discountAmount);
  const applyCardFee =
    spec.paymentMethod === PaymentMethod.CARD && spec.hasCardFee === true;
  const cardFeeAmount = applyCardFee
    ? toMoney(amountAfterDiscount * CARD_FEE_RATE)
    : 0;
  const totalPaid = toMoney(amountAfterDiscount + cardFeeAmount);
  const totalCommission = toMoney(
    details.reduce((sum, detail) => sum + detail.lineCommission, 0),
  );
  const createdAt = atSalonDate(weekStart, spec.dayOffset, spec.hour);

  const created = await prisma.dailyRegister.create({
    data: {
      clientName: spec.clientName,
      paymentMethod: spec.paymentMethod,
      subtotalBase: new Prisma.Decimal(subtotalBase.toFixed(2)),
      discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
      cardFeeAmount: new Prisma.Decimal(cardFeeAmount.toFixed(2)),
      totalPaid: new Prisma.Decimal(totalPaid.toFixed(2)),
      totalCommission: new Prisma.Decimal(totalCommission.toFixed(2)),
      mesaUserId: mesaId,
      createdById: adminId,
      createdAt,
      updatedAt: createdAt,
      details: {
        create: details.map((detail) => ({
          serviceId: detail.serviceId,
          unitPrice: new Prisma.Decimal(detail.unitPrice.toFixed(2)),
          commissionRate: new Prisma.Decimal(detail.commissionRate.toFixed(2)),
          quantity: detail.quantity,
          lineSubtotal: new Prisma.Decimal(detail.lineSubtotal.toFixed(2)),
          lineCommission: new Prisma.Decimal(detail.lineCommission.toFixed(2)),
        })),
      },
    },
    select: { id: true },
  });

  return created.id;
}

async function createAdvance(params: {
  mesaUserId: string;
  adminId: string;
  amount: number;
  reason: string;
  date: Date;
  status?: AdvanceStatus;
}): Promise<string> {
  const created = await prisma.advance.create({
    data: {
      mesaUserId: params.mesaUserId,
      amount: new Prisma.Decimal(params.amount.toFixed(2)),
      reason: params.reason,
      date: params.date,
      status: params.status ?? AdvanceStatus.PENDING,
      createdById: params.adminId,
      createdAt: params.date,
      updatedAt: params.date,
    },
    select: { id: true },
  });
  return created.id;
}

async function closePayrollForMesa(params: {
  mesaUserId: string;
  adminId: string;
  week: { start: Date; end: Date };
}): Promise<string> {
  const [registers, advances] = await Promise.all([
    prisma.dailyRegister.findMany({
      where: {
        mesaUserId: params.mesaUserId,
        isDeleted: false,
        payrollId: null,
        createdAt: { gte: params.week.start, lte: params.week.end },
      },
      select: {
        id: true,
        createdAt: true,
        totalPaid: true,
        details: { select: { lineSubtotal: true, lineCommission: true } },
      },
    }),
    prisma.advance.findMany({
      where: {
        mesaUserId: params.mesaUserId,
        isDeleted: false,
        status: AdvanceStatus.PENDING,
        date: { lte: params.week.end },
      },
      select: { id: true, amount: true },
    }),
  ]);

  const totals = calculatePayrollTotals(registers, advances, TZ);
  const closedAt = new Date(params.week.end.getTime() + 60_000);

  const payroll = await prisma.payroll.create({
    data: {
      mesaUserId: params.mesaUserId,
      periodStart: params.week.start,
      periodEnd: params.week.end,
      grossSales: new Prisma.Decimal(totals.grossSales.toFixed(2)),
      baseCommissionTotal: new Prisma.Decimal(
        totals.baseCommissionTotal.toFixed(2),
      ),
      weekendBonusTotal: new Prisma.Decimal(totals.weekendBonusTotal.toFixed(2)),
      advancesDeductionTotal: new Prisma.Decimal(
        totals.advancesDeductionTotal.toFixed(2),
      ),
      netPayable: new Prisma.Decimal(totals.netPayable.toFixed(2)),
      status: PayrollStatus.CLOSED,
      closedAt,
      closedById: params.adminId,
      createdAt: closedAt,
      updatedAt: closedAt,
    },
    select: { id: true },
  });

  if (totals.registerIds.length) {
    await prisma.dailyRegister.updateMany({
      where: { id: { in: totals.registerIds } },
      data: { payrollId: payroll.id },
    });
  }
  if (totals.advanceIds.length) {
    await prisma.advance.updateMany({
      where: { id: { in: totals.advanceIds } },
      data: { status: AdvanceStatus.APPLIED, payrollId: payroll.id },
    });
  }

  return payroll.id;
}

async function main(): Promise<void> {
  console.log('Seeding demo data for Harumi Nails...\n');
  const roleIds = await ensureRoles();
  const { adminId, mesas } = await upsertDemoUsers(roleIds);
  const services = await upsertServices(adminId);
  await resetMesaOperationalData(Object.values(mesas));

  const currentWeek = getSalonPayrollWeekRange(TZ);
  const weeks = {
    [-2]: shiftWeek(currentWeek, -2),
    [-1]: shiftWeek(currentWeek, -1),
    0: currentWeek,
  } as const;

  for (const ticket of TICKETS) {
    await createTicket(
      ticket,
      weeks[ticket.weekOffset].start,
      mesas[ticket.mesa],
      adminId,
      services,
    );
  }
  console.log(`Daily registers created: ${TICKETS.length}`);

  await createAdvance({
    mesaUserId: mesas.gabriela,
    adminId,
    amount: 25,
    reason: 'Adelanto semana del 12 sep — materiales',
    date: atSalonDate(weeks[-2].start, 3, 9),
  });
  await createAdvance({
    mesaUserId: mesas.valeria,
    adminId,
    amount: 18,
    reason: 'Adelanto semana del 19 sep — personal',
    date: atSalonDate(weeks[-1].start, 2, 9),
  });

  const payrollWeek2 = await closePayrollForMesa({
    mesaUserId: mesas.gabriela,
    adminId,
    week: weeks[-2],
  });
  const payrollWeek1 = await closePayrollForMesa({
    mesaUserId: mesas.valeria,
    adminId,
    week: weeks[-1],
  });
  console.log(`Closed payrolls: ${payrollWeek2}, ${payrollWeek1}`);

  await createAdvance({
    mesaUserId: mesas.gabriela,
    adminId,
    amount: 10,
    reason: 'Pending voucher Mesa 1',
    date: atSalonDate(weeks[0].start, 2, 9),
  });
  await createAdvance({
    mesaUserId: mesas.valeria,
    adminId,
    amount: 15,
    reason: 'Pending voucher Mesa 2',
    date: atSalonDate(weeks[0].start, 3, 9),
  });
  await createAdvance({
    mesaUserId: mesas.sofia,
    adminId,
    amount: 20,
    reason: 'Pending voucher Mesa 3',
    date: atSalonDate(weeks[0].start, 4, 9),
  });

  console.log('\nDemo seed completed.');
  console.log('Login (password for all): Admin1234*');
  console.log('  SUPER_ADMIN  superadmin@harumi.com');
  console.log('  ADMIN        admin@harumi.com');
  console.log('  Mesa 1       gabriela.rios@harumi.com  (Gabriela Ríos)');
  console.log('  Mesa 2       valeria.gomez@harumi.com  (Valeria Gómez)');
  console.log('  Mesa 3       sofia.morales@harumi.com  (Sofia Morales)');
  console.log('Current payroll week is OPEN (no CLOSED payroll).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
