import { AdvanceStatus, PayrollStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const MARKER = '[E2E-FULL]';
const SALON_TZ = 'America/Guayaquil';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; roles: string[]; permissions: string[] };
};

type CheckResult = {
  module: string;
  name: string;
  ok: boolean;
  detail?: string;
};

type RegisterResponse = {
  id: string;
  mesaUserId: string;
  totalPaid: number;
  totalCommission: number;
  discountAmount: number;
  cardFeeAmount: number;
  subtotalBase: number;
  paymentMethod: string;
  details: Array<{
    unitPrice: number;
    commissionRate: number;
    lineSubtotal: number;
    lineCommission: number;
  }>;
};

const checks: CheckResult[] = [];
const created = {
  userIds: new Set<string>(),
  serviceIds: new Set<string>(),
  registerIds: new Set<string>(),
  advanceIds: new Set<string>(),
  payrollIds: new Set<string>(),
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nearlyEqual(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.001;
}

class CheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckError';
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
): Promise<{ status: number; data: T; raw: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const raw = await response.text();
  let data = {} as T;
  if (raw) {
    try {
      data = JSON.parse(raw) as T;
    } catch {
      data = {} as T;
    }
  }
  return { status: response.status, data, raw };
}

async function check(
  module: string,
  name: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  try {
    await fn();
    checks.push({ module, name, ok: true });
    console.log(`  ✔️  ${name}`);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    checks.push({ module, name, ok: false, detail });
    console.log(`  ❌  ${name}`);
    console.log(`      ${detail}`);
    return false;
  }
}

function expectStatus(
  status: number,
  expected: number | number[],
  raw: string,
  label: string,
): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(status)) {
    throw new CheckError(
      `${label}: HTTP ${status} (expected ${allowed.join('|')}): ${raw.slice(0, 280)}`,
    );
  }
}

function expectEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new CheckError(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectMoney(actual: number, expected: number, label: string): void {
  if (!nearlyEqual(Number(actual), expected)) {
    throw new CheckError(`${label}: expected ${expected}, got ${actual}`);
  }
}

function getCalendarDate(instant = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function addDays(
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

function weekdayIndex(calendar: { year: number; month: number; day: number }): number {
  const noon = new Date(Date.UTC(calendar.year, calendar.month - 1, calendar.day, 17));
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: SALON_TZ,
    weekday: 'short',
  }).format(noon);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[label] ?? 6;
}

function isoDate(calendar: { year: number; month: number; day: number }): string {
  return `${calendar.year}-${String(calendar.month).padStart(2, '0')}-${String(calendar.day).padStart(2, '0')}`;
}

function currentPayrollWeek(): { start: string; end: string; saturdayUtc: Date } {
  const today = getCalendarDate();
  const saturday = addDays(today, -((weekdayIndex(today) + 1) % 7));
  const friday = addDays(saturday, 6);
  return {
    start: isoDate(saturday),
    end: isoDate(friday),
    saturdayUtc: new Date(`${isoDate(saturday)}T17:00:00.000Z`),
  };
}

async function login(
  email: string,
  password: string,
): Promise<{ status: number; data: LoginResponse; raw: string }> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

async function voidRegister(token: string, id: string): Promise<void> {
  await request(`/daily-registers/${id}`, { method: 'DELETE', token });
}

async function cleanupArtifacts(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: [...created.userIds] } },
        { email: { startsWith: 'e2e.full.' } },
      ],
    },
    select: { id: true },
  });
  const userIds = [...new Set(users.map((user) => user.id))];

  const registers = await prisma.dailyRegister.findMany({
    where: {
      OR: [
        { id: { in: [...created.registerIds] } },
        { clientName: { startsWith: MARKER } },
        ...(userIds.length ? [{ mesaUserId: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const registerIds = registers.map((row) => row.id);

  const advances = await prisma.advance.findMany({
    where: {
      OR: [
        { id: { in: [...created.advanceIds] } },
        { reason: { startsWith: MARKER } },
        ...(userIds.length ? [{ mesaUserId: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const advanceIds = advances.map((row) => row.id);

  const payrolls = await prisma.payroll.findMany({
    where: {
      OR: [
        { id: { in: [...created.payrollIds] } },
        ...(userIds.length ? [{ mesaUserId: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const payrollIds = payrolls.map((row) => row.id);

  const services = await prisma.service.findMany({
    where: {
      OR: [
        { id: { in: [...created.serviceIds] } },
        { name: { startsWith: MARKER } },
      ],
    },
    select: { id: true },
  });
  const serviceIds = services.map((row) => row.id);

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
    if (advanceIds.length) {
      await tx.advance.updateMany({
        where: { id: { in: advanceIds } },
        data: { payrollId: null },
      });
    }
    if (registerIds.length) {
      await tx.dailyRegister.deleteMany({ where: { id: { in: registerIds } } });
    }
    if (advanceIds.length) {
      await tx.advance.deleteMany({ where: { id: { in: advanceIds } } });
    }
    if (payrollIds.length) {
      await tx.payroll.deleteMany({ where: { id: { in: payrollIds } } });
    }
    if (serviceIds.length) {
      await tx.service.deleteMany({ where: { id: { in: serviceIds } } });
    }
    if (userIds.length) {
      await tx.session.deleteMany({ where: { userId: { in: userIds } } });
      await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });
}

function printReport(): number {
  const failed = checks.filter((item) => !item.ok);
  const passed = checks.filter((item) => item.ok);
  console.log('\n========================================');
  console.log('  REPORTE E2E HARUMI NAILS — SISTEMA');
  console.log('========================================');

  const modules = [...new Set(checks.map((item) => item.module))];
  for (const moduleName of modules) {
    const items = checks.filter((item) => item.module === moduleName);
    const okCount = items.filter((item) => item.ok).length;
    console.log(`\n${moduleName}  (${okCount}/${items.length})`);
    for (const item of items) {
      console.log(`  ${item.ok ? '✔️' : '❌'}  ${item.name}`);
      if (!item.ok && item.detail) {
        console.log(`      ${item.detail}`);
      }
    }
  }

  console.log('\n----------------------------------------');
  console.log(`Total: ${passed.length} ✔️   ${failed.length} ❌   ${checks.length} checks`);
  console.log('----------------------------------------\n');
  return failed.length;
}

async function main(): Promise<void> {
  await cleanupArtifacts();

  const week = currentPayrollWeek();
  const stamp = Date.now();
  const e2eEmail = `e2e.full.${stamp}@haruminails.com`;
  const e2ePassword = 'E2eFull99!';
  const serviceName = `${MARKER} Manicure ${stamp}`;

  console.log('\n▶ Module 1: Authentication, Users and RBAC');
  let admin!: LoginResponse;
  let seedMesa!: LoginResponse;

  await check('M1 Authentication / RBAC', 'ADMIN login with valid credentials', async () => {
    const result = await login('admin@haruminails.com', 'Admin123!');
    expectStatus(result.status, 200, result.raw, 'login admin');
    if (!result.data.accessToken || !result.data.refreshToken) {
      throw new CheckError('Admin login did not return tokens');
    }
    admin = result.data;
  });

  if (!admin) {
    throw new CheckError('Could not authenticate ADMIN; aborting the E2E.');
  }

  await check('M1 Authentication / RBAC', 'Seed MESA login with valid credentials', async () => {
    const result = await login('mesa10@haruminails.com', 'Mesa1234!');
    expectStatus(result.status, 200, result.raw, 'login mesa10');
    seedMesa = result.data;
  });

  await check('M1 Authentication / RBAC', 'Invalid login returns 401', async () => {
    const result = await login('admin@haruminails.com', 'WrongPass1');
    expectStatus(result.status, 401, result.raw, 'invalid login');
  });

  await check('M1 Authentication / RBAC', 'Protected endpoint without token returns 401', async () => {
    const result = await request('/users/me');
    expectStatus(result.status, 401, result.raw, 'GET /users/me without token');
  });

  await check(
    'M1 Authentication / RBAC',
    'MESA no puede crear usuarios (403)',
    async () => {
      if (!seedMesa) {
        throw new CheckError('MESA token is missing');
      }
      const result = await request('/users', {
        method: 'POST',
        token: seedMesa.accessToken,
        body: {
          firstName: 'Hack',
          lastName: 'User',
          email: `e2e.full.forbidden.${stamp}@haruminails.com`,
          password: e2ePassword,
          roleIds: ['00000000-0000-4000-8000-000000000001'],
        },
      });
      expectStatus(result.status, 403, result.raw, 'MESA POST /users');
    },
  );

  await check('M1 Authentication / RBAC', 'Session revocation (logout + refresh 401)', async () => {
    const sessionLogin = await login('admin@haruminails.com', 'Admin123!');
    expectStatus(sessionLogin.status, 200, sessionLogin.raw, 'session login');
    const logout = await request('/auth/logout', {
      method: 'POST',
      token: sessionLogin.data.accessToken,
      body: { refreshToken: sessionLogin.data.refreshToken },
    });
    expectStatus(logout.status, 204, logout.raw, 'logout');

    const hashed = sessionLogin.data.refreshToken;
    const refresh = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: hashed },
    });
    expectStatus(refresh.status, 401, refresh.raw, 'refresh revocado');

    const sessions = await prisma.session.findMany({
      where: { userId: sessionLogin.data.user.id, isRevoked: true },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });
    if (sessions.length === 0) {
      throw new CheckError('No session marked isRevoked=true after logout');
    }
  });

  console.log('\n▶ Module 2: Service Catalog');
  let mesaRoleId = '';
  let e2eUserId = '';
  let e2eMesa!: LoginResponse;
  let serviceId = '';
  const listPrice = 20;
  const listCommissionPct = 50;
  const expectedLineCommission = money(listPrice * (listCommissionPct / 100));

  await check('M2 Catalog', 'ADMIN creates test MESA user', async () => {
    const roles = await request<Array<{ id: string; name: string }>>('/roles', {
      token: admin.accessToken,
    });
    expectStatus(roles.status, 200, roles.raw, 'GET /roles');
    const mesaRole = roles.data.find((role) => role.name === 'MESA');
    if (!mesaRole) {
      throw new CheckError('Rol MESA no encontrado');
    }
    mesaRoleId = mesaRole.id;

    const createdUser = await request<{ id: string }>('/users', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        firstName: 'E2E',
        lastName: 'FullSystem',
        email: e2eEmail,
        password: e2ePassword,
        roleIds: [mesaRoleId],
      },
    });
    expectStatus(createdUser.status, 201, createdUser.raw, 'POST /users');
    e2eUserId = createdUser.data.id;
    created.userIds.add(e2eUserId);

    const mesaLogin = await login(e2eEmail, e2ePassword);
    expectStatus(mesaLogin.status, 200, mesaLogin.raw, 'login MESA E2E');
    e2eMesa = mesaLogin.data;
  });

  await check('M2 Catalog', 'Create service with price and commission', async () => {
    const createdService = await request<{
      id: string;
      price: number;
      commissionPercentage: number;
    }>('/services', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        name: serviceName,
        category: 'E2E',
        price: listPrice,
        commissionPercentage: listCommissionPct,
      },
    });
    expectStatus(createdService.status, 201, createdService.raw, 'POST /services');
    serviceId = createdService.data.id;
    created.serviceIds.add(serviceId);
    expectMoney(Number(createdService.data.price), listPrice, 'precio');
    expectMoney(
      Number(createdService.data.commissionPercentage),
      listCommissionPct,
      'commission %',
    );
  });

  let snapshotRegisterId = '';
  await check('M2 Catalog', 'Editing price/commission does not change past tickets', async () => {
    if (!serviceId || !e2eUserId) {
      throw new CheckError('Missing service or E2E MESA user');
    }
    const snapshot = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Snapshot`,
        paymentMethod: 'CASH',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(snapshot.status, 201, snapshot.raw, 'ticket snapshot');
    snapshotRegisterId = snapshot.data.id;
    created.registerIds.add(snapshotRegisterId);
    expectMoney(snapshot.data.details[0].unitPrice, listPrice, 'unitPrice snapshot');
    expectMoney(
      snapshot.data.details[0].lineCommission,
      expectedLineCommission,
      'lineCommission snapshot',
    );

    const updated = await request<{ price: number; commissionPercentage: number }>(
      `/services/${serviceId}`,
      {
        method: 'PATCH',
        token: admin.accessToken,
        body: { price: 40, commissionPercentage: 60 },
      },
    );
    expectStatus(updated.status, 200, updated.raw, 'PATCH servicio');
    expectMoney(Number(updated.data.price), 40, 'precio editado');

    const past = await request<RegisterResponse>(`/daily-registers/${snapshotRegisterId}`, {
      token: admin.accessToken,
    });
    expectStatus(past.status, 200, past.raw, 'GET snapshot');
    expectMoney(past.data.details[0].unitPrice, listPrice, 'snapshot unitPrice intacto');
    expectMoney(
      past.data.details[0].commissionRate,
      listCommissionPct,
      'snapshot commission % unchanged',
    );
    expectMoney(
      past.data.details[0].lineCommission,
      expectedLineCommission,
      'snapshot commission unchanged',
    );
  });

  await check('M2 Catalog', 'Deactivating a service keeps history and blocks new POS sales', async () => {
    if (!serviceId || !snapshotRegisterId) {
      throw new CheckError('Missing service or snapshot');
    }
    const deactivated = await request(`/services/${serviceId}/status`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { isActive: false },
    });
    expectStatus(deactivated.status, 200, deactivated.raw, 'desactivar');

    const past = await request<RegisterResponse>(`/daily-registers/${snapshotRegisterId}`, {
      token: admin.accessToken,
    });
    expectStatus(past.status, 200, past.raw, 'historial tras desactivar');
    expectMoney(past.data.totalPaid, listPrice, 'totalPaid historial');

    const blocked = await request('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Servicio inactivo`,
        paymentMethod: 'CASH',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(blocked.status, 400, blocked.raw, 'POS con servicio inactivo');

    const restored = await request(`/services/${serviceId}/status`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { isActive: true },
    });
    expectStatus(restored.status, 200, restored.raw, 'reactivar');

    const priceBack = await request(`/services/${serviceId}`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { price: listPrice, commissionPercentage: listCommissionPct },
    });
    expectStatus(priceBack.status, 200, priceBack.raw, 'restaurar precio');
    await voidRegister(admin.accessToken, snapshotRegisterId);
  });

  console.log('\n▶ Module 3: Daily Cash Register (POS)');

  await check('M3 POS', 'Discount lowers client payment, commission stays on list price', async () => {
    if (!serviceId || !e2eUserId) {
      throw new CheckError('Missing service or MESA user');
    }
    const discount = 5;
    const ticket = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Descuento`,
        paymentMethod: 'CASH',
        discountAmount: discount,
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(ticket.status, 201, ticket.raw, 'ticket descuento');
    created.registerIds.add(ticket.data.id);
    expectMoney(ticket.data.subtotalBase, listPrice, 'subtotal lista');
    expectMoney(ticket.data.totalPaid, money(listPrice - discount), 'cliente paga menos');
    expectMoney(ticket.data.totalCommission, expectedLineCommission, 'commission unchanged');
    await voidRegister(admin.accessToken, ticket.data.id);
  });

  await check('M3 POS', '5% surcharge applies only to CARD', async () => {
    if (!serviceId || !e2eUserId) {
      throw new CheckError('Missing service or MESA user');
    }
    const card = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Tarjeta`,
        paymentMethod: 'CARD',
        hasCardFee: true,
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(card.status, 201, card.raw, 'ticket CARD');
    created.registerIds.add(card.data.id);
    expectMoney(card.data.cardFeeAmount, money(listPrice * 0.05), 'recargo 5%');
    expectMoney(card.data.totalPaid, money(listPrice * 1.05), 'total CARD');
    expectMoney(card.data.totalCommission, expectedLineCommission, 'CARD commission');

    const cashWithFlag = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Cash con flag`,
        paymentMethod: 'CASH',
        hasCardFee: true,
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(cashWithFlag.status, 201, cashWithFlag.raw, 'ticket CASH+flag');
    created.registerIds.add(cashWithFlag.data.id);
    expectMoney(cashWithFlag.data.cardFeeAmount, 0, 'CASH sin recargo');
    expectMoney(cashWithFlag.data.totalPaid, listPrice, 'total CASH');
    await voidRegister(admin.accessToken, card.data.id);
    await voidRegister(admin.accessToken, cashWithFlag.data.id);
  });

  await check('M3 POS', 'MESA solo registra a su nombre; ADMIN elige cualquier mesa', async () => {
    if (!e2eMesa || !serviceId || !e2eUserId || !seedMesa) {
      throw new CheckError('Missing MESA actors');
    }
    const mesaTicket = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: e2eMesa.accessToken,
      body: {
        mesaUserId: seedMesa.user.id,
        clientName: `${MARKER} Mesa propia`,
        paymentMethod: 'CASH',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(mesaTicket.status, 201, mesaTicket.raw, 'ticket MESA');
    created.registerIds.add(mesaTicket.data.id);
    expectEqual(mesaTicket.data.mesaUserId, e2eUserId, 'MESA no puede vender a otra mesa');

    const adminTicket = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Semana`,
        paymentMethod: 'CASH',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(adminTicket.status, 201, adminTicket.raw, 'ticket ADMIN');
    created.registerIds.add(adminTicket.data.id);
    expectEqual(adminTicket.data.mesaUserId, e2eUserId, 'ADMIN asigna mesa E2E');
    await voidRegister(admin.accessToken, mesaTicket.data.id);
  });

  console.log('\n▶ Module 4: Vouchers and Advances');
  let payrollAdvanceId = '';

  await check('M4 Vales', 'Create PENDING voucher and cancel it successfully', async () => {
    if (!e2eUserId) {
      throw new CheckError('Missing E2E MESA user');
    }
    const pending = await request<{ id: string; status: string }>('/advances', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        amount: 10,
        reason: `${MARKER} Cancellable voucher`,
      },
    });
    expectStatus(pending.status, 201, pending.raw, 'POST voucher');
    created.advanceIds.add(pending.data.id);
    expectEqual(pending.data.status, 'PENDING', 'PENDING status');

    const cancelled = await request<{ status: string }>(`/advances/${pending.data.id}/cancel`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { reason: 'Issued by mistake, cancel today.' },
    });
    expectStatus(cancelled.status, 200, cancelled.raw, 'cancel PENDING');
    expectEqual(cancelled.data.status, 'CANCELLED', 'CANCELLED status');
  });

  await check('M4 Vales', 'Create second PENDING voucher for payroll ($20)', async () => {
    if (!e2eUserId) {
      throw new CheckError('Missing E2E MESA user');
    }
    const voucher = await request<{ id: string; status: string }>('/advances', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        amount: 20,
        reason: `${MARKER} Payroll voucher`,
      },
    });
    expectStatus(voucher.status, 201, voucher.raw, 'POST payroll voucher');
    created.advanceIds.add(voucher.data.id);
    payrollAdvanceId = voucher.data.id;
    expectEqual(voucher.data.status, 'PENDING', 'PENDING for generate');
  });

  console.log('\n▶ Module 5: Payroll and Weekly Settlement');
  let weekdayId = '';
  let weekendId = '';
  let payrollId = '';

  await check('M5 Payroll', 'Preview with weekend bonus +5%', async () => {
    if (!serviceId || !e2eUserId || !payrollAdvanceId) {
      throw new CheckError('Missing payroll inputs');
    }
    const weekday = await prisma.dailyRegister.findFirst({
      where: { clientName: `${MARKER} Semana`, mesaUserId: e2eUserId, isDeleted: false },
    });
    if (!weekday) {
      throw new CheckError('Weekday ticket is missing');
    }
    weekdayId = weekday.id;

    const weekend = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Fin de semana`,
        paymentMethod: 'CASH',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(weekend.status, 201, weekend.raw, 'ticket fin de semana');
    weekendId = weekend.data.id;
    created.registerIds.add(weekendId);
    await prisma.dailyRegister.update({
      where: { id: weekendId },
      data: { createdAt: week.saturdayUtc },
    });

    const preview = await request<{
      baseCommissionTotal: number;
      weekendBonusTotal: number;
      advancesDeductionTotal: number;
      netPayable: number;
      registerIds: string[];
      advanceIds: string[];
    }>('/payroll/preview', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        periodStart: week.start,
        periodEnd: week.end,
      },
    });
    expectStatus(preview.status, 201, preview.raw, 'preview');
    if (!preview.data.registerIds.includes(weekdayId)) {
      throw new CheckError('Preview no incluye ticket laboral');
    }
    if (!preview.data.registerIds.includes(weekendId)) {
      throw new CheckError('Preview no incluye ticket de fin de semana');
    }
    const expectedBonus = money(listPrice * 0.05);
    const expectedBase = money(expectedLineCommission * 2);
    const expectedNet = money(expectedBase + expectedBonus - 20);
    expectMoney(preview.data.weekendBonusTotal, expectedBonus, 'bono +5%');
    expectMoney(preview.data.baseCommissionTotal, expectedBase, 'base commission');
    expectMoney(preview.data.advancesDeductionTotal, 20, 'vales');
    expectMoney(preview.data.netPayable, expectedNet, 'neto');
    if (!preview.data.advanceIds.includes(payrollAdvanceId)) {
      throw new CheckError('Preview is missing the payroll voucher');
    }
  });

  await check('M5 Payroll', 'Atomic generate: DRAFT + payrollId on tickets and APPLIED voucher', async () => {
    if (!e2eUserId || !weekdayId || !weekendId || !payrollAdvanceId) {
      throw new CheckError('Missing IDs for generate');
    }
    const generated = await request<{ id: string; status: string }>('/payroll/generate', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        periodStart: week.start,
        periodEnd: week.end,
      },
    });
    expectStatus(generated.status, 201, generated.raw, 'generate');
    payrollId = generated.data.id;
    created.payrollIds.add(payrollId);
    expectEqual(generated.data.status, PayrollStatus.DRAFT, 'status DRAFT');

    const [advanceRow, weekdayRow, weekendRow] = await Promise.all([
      prisma.advance.findUnique({ where: { id: payrollAdvanceId } }),
      prisma.dailyRegister.findUnique({ where: { id: weekdayId } }),
      prisma.dailyRegister.findUnique({ where: { id: weekendId } }),
    ]);
    expectEqual(advanceRow?.status, AdvanceStatus.APPLIED, 'vale APPLIED');
    expectEqual(advanceRow?.payrollId, payrollId, 'vale.payrollId');
    expectEqual(weekdayRow?.payrollId, payrollId, 'ticket laboral.payrollId');
    expectEqual(weekendRow?.payrollId, payrollId, 'ticket weekend.payrollId');
  });

  await check('M5 Payroll', 'APPLIED voucher cannot be cancelled or deleted (400)', async () => {
    if (!payrollAdvanceId) {
      throw new CheckError('Missing APPLIED voucher');
    }
    const cancel = await request(`/advances/${payrollAdvanceId}/cancel`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { reason: 'Attempt to cancel an applied voucher.' },
    });
    expectStatus(cancel.status, 400, cancel.raw, 'cancel APPLIED');
    const remove = await request(`/advances/${payrollAdvanceId}`, {
      method: 'DELETE',
      token: admin.accessToken,
    });
    expectStatus(remove.status, 400, remove.raw, 'delete APPLIED');
  });

  await check('M5 Payroll', 'Close payroll (CLOSED) and block duplicate settlement (409)', async () => {
    if (!payrollId || !e2eUserId) {
      throw new CheckError('Missing payrollId');
    }
    const closed = await request<{ status: string }>(`/payroll/${payrollId}/close`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { payrollId },
    });
    expectStatus(closed.status, 200, closed.raw, 'close');
    expectEqual(closed.data.status, PayrollStatus.CLOSED, 'CLOSED');

    const db = await prisma.payroll.findUnique({ where: { id: payrollId } });
    expectEqual(db?.status, PayrollStatus.CLOSED, 'DB CLOSED');

    const again = await request('/payroll/generate', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        periodStart: week.start,
        periodEnd: week.end,
      },
    });
    expectStatus(again.status, 409, again.raw, 'duplicate generate');
  });

  const failed = printReport();
  console.log('Cleaning E2E artifacts...');
  await cleanupArtifacts();
  console.log('Database has no leftovers from this script.\n');
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(async (error) => {
    console.error('\nFatal runner error:', error);
    printReport();
    try {
      await cleanupArtifacts();
      console.log('Emergency cleanup completed.');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
