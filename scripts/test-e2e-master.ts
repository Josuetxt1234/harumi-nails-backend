import { AdvanceStatus, PayrollStatus, PrismaClient } from '@prisma/client';
import {
  demoAdminAccount,
  demoMesaAccount,
  generateTestPassword,
  seedAdminAccount,
  seedMesaAccount,
} from '../prisma/seed-credentials';

const prisma = new PrismaClient();
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const MARKER = '[E2E-MASTER]';
const SALON_TZ = 'America/Guayaquil';

const ADMIN_CANDIDATES = [seedAdminAccount(), demoAdminAccount()];
const MESA_CANDIDATES = [seedMesaAccount(), demoMesaAccount()];

type LoginBody = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
    mustChangePassword: boolean;
  };
};

// The refresh token now travels in an HttpOnly cookie, never in the body.
type LoginResponse = LoginBody & { refreshCookie: string };

const REFRESH_COOKIE = 'harumi_refresh_token';

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

type MaterialResponse = {
  id: string;
  currentStock: number;
  minimumStock: number;
  isLowStock: boolean;
};

type MovementResponse = {
  type: string;
  quantity: number;
  newStock: number;
  reason: string;
};

const checks: CheckResult[] = [];
const created = {
  userIds: new Set<string>(),
  serviceIds: new Set<string>(),
  registerIds: new Set<string>(),
  advanceIds: new Set<string>(),
  payrollIds: new Set<string>(),
  materialIds: new Set<string>(),
  categoryIds: new Set<string>(),
};

class CheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckError';
  }
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nearlyEqual(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.001;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    refreshCookie?: string;
  } = {},
): Promise<{ status: number; data: T; raw: string; refreshCookie: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.refreshCookie) {
    headers.Cookie = `${REFRESH_COOKIE}=${options.refreshCookie}`;
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
  const setCookie = response.headers.get('set-cookie') ?? '';
  const refreshCookie =
    new RegExp(`${REFRESH_COOKIE}=([^;]*)`).exec(setCookie)?.[1] ?? '';

  return { status: response.status, data, raw, refreshCookie };
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

async function loginWith(
  candidates: Array<{ email: string; password: string }>,
  label: string,
): Promise<LoginResponse> {
  let lastRaw = '';
  for (const candidate of candidates) {
    const result = await request<LoginBody>('/auth/login', {
      method: 'POST',
      body: { email: candidate.email, password: candidate.password },
    });
    if (result.status === 200 && result.data.accessToken) {
      const session = { ...result.data, refreshCookie: result.refreshCookie };

      return session.user.mustChangePassword
        ? settleTemporaryPassword(session, candidate)
        : session;
    }
    lastRaw = `${candidate.email} HTTP ${result.status} ${result.raw.slice(0, 120)}`;
  }
  throw new CheckError(`Could not authenticate ${label}: ${lastRaw}`);
}

/**
 * Seeded accounts carry a temporary password, which MustChangePasswordGuard
 * blocks on every route but the escape hatch. Re-setting the same password
 * clears the flag without moving the credential the suite depends on.
 */
async function settleTemporaryPassword(
  session: LoginResponse,
  candidate: { email: string; password: string },
): Promise<LoginResponse> {
  const settled = await request('/users/me/password', {
    method: 'PATCH',
    token: session.accessToken,
    body: {
      currentPassword: candidate.password,
      newPassword: candidate.password,
    },
  });

  if (settled.status !== 204) {
    throw new CheckError(
      `Could not clear the temporary password of ${candidate.email}: HTTP ${settled.status} ${settled.raw.slice(0, 120)}`,
    );
  }

  // Changing the password revokes every session, so the old token is dead.
  const reissued = await request<LoginBody>('/auth/login', {
    method: 'POST',
    body: { email: candidate.email, password: candidate.password },
  });

  if (reissued.status !== 200) {
    throw new CheckError(
      `Could not re-authenticate ${candidate.email}: HTTP ${reissued.status} ${reissued.raw.slice(0, 120)}`,
    );
  }

  return { ...reissued.data, refreshCookie: reissued.refreshCookie };
}

async function voidRegister(token: string, id: string): Promise<void> {
  await request(`/daily-registers/${id}`, { method: 'DELETE', token });
}

async function cleanupArtifacts(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: [...created.userIds] } },
        { email: { startsWith: 'e2e.master.' } },
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

  const materials = await prisma.material.findMany({
    where: {
      OR: [
        { id: { in: [...created.materialIds] } },
        { code: { startsWith: 'E2E-MST-' } },
      ],
    },
    select: { id: true, categoryId: true },
  });
  const materialIds = materials.map((row) => row.id);
  const categoryIds = [
    ...new Set([
      ...created.categoryIds,
      ...materials.map((row) => row.categoryId),
    ]),
  ];

  await prisma.$transaction(async (tx) => {
    if (materialIds.length) {
      await tx.inventoryMovement.deleteMany({
        where: { materialId: { in: materialIds } },
      });
      await tx.material.deleteMany({ where: { id: { in: materialIds } } });
    }
    if (categoryIds.length) {
      const leftover = await tx.material.count({
        where: { categoryId: { in: categoryIds } },
      });
      if (leftover === 0) {
        await tx.inventoryCategory.deleteMany({
          where: {
            OR: [
              { id: { in: categoryIds } },
              { name: { startsWith: 'E2E-MST' } },
            ],
          },
        });
      }
    }
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
  console.log('  REPORTE E2E MASTER — HARUMI NAILS');
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
  console.log(`TOTAL GLOBAL: ${passed.length} ✔️  ${failed.length} ❌`);
  console.log('----------------------------------------\n');
  return failed.length;
}

async function main(): Promise<void> {
  await cleanupArtifacts();

  const week = currentPayrollWeek();
  const stamp = Date.now();
  const e2eEmail = `e2e.master.${stamp}@haruminails.com`;
  const e2ePassword = generateTestPassword();
  const e2eSettledPassword = generateTestPassword();
  const serviceName = `${MARKER} Manicure ${stamp}`;
  const materialCode = `E2E-MST-${stamp}`;
  const listPrice = 20;
  const listCommissionPct = 50;
  const expectedLineCommission = money(listPrice * (listCommissionPct / 100));

  console.log('\n🔐  M1: Auth & RBAC');
  let admin!: LoginResponse;
  let seedMesa!: LoginResponse;

  await check('M1 Auth & RBAC', 'Valid ADMIN login', async () => {
    admin = await loginWith(ADMIN_CANDIDATES, 'ADMIN');
    if (!admin.refreshCookie) {
      throw new CheckError(
        'Admin login did not set the HttpOnly refresh token cookie',
      );
    }
  });

  if (!admin) {
    throw new CheckError('Could not authenticate ADMIN; aborting the master E2E.');
  }

  await check('M1 Auth & RBAC', 'Valid MESA login', async () => {
    seedMesa = await loginWith(MESA_CANDIDATES, 'MESA');
  });

  await check('M1 Auth & RBAC', 'Invalid login returns 401', async () => {
    const result = await request('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_CANDIDATES[0].email, password: 'WrongPass1' },
    });
    expectStatus(result.status, 401, result.raw, 'invalid login');
  });

  await check('M1 Auth & RBAC', 'Protected request without token returns 401', async () => {
    const result = await request('/inventory/materials');
    expectStatus(result.status, 401, result.raw, 'GET inventory without token');
  });

  await check('M1 Auth & RBAC', 'MESA blocked from ADMIN routes (403)', async () => {
    if (!seedMesa) {
      throw new CheckError('MESA token is missing');
    }
    const createUser = await request('/users', {
      method: 'POST',
      token: seedMesa.accessToken,
      body: {
        firstName: 'Hack',
        lastName: 'User',
        email: `e2e.master.forbidden.${stamp}@haruminails.com`,
        password: e2ePassword,
        roleIds: ['00000000-0000-4000-8000-000000000001'],
      },
    });
    expectStatus(createUser.status, 403, createUser.raw, 'MESA POST /users');

    const createService = await request('/services', {
      method: 'POST',
      token: seedMesa.accessToken,
      body: {
        name: `${MARKER} Forbidden`,
        category: 'E2E',
        price: 10,
        commissionPercentage: 50,
      },
    });
    expectStatus(createService.status, 403, createService.raw, 'MESA POST /services');

    const generatePayroll = await request('/payroll/generate', {
      method: 'POST',
      token: seedMesa.accessToken,
      body: { mesaUserId: seedMesa.user.id },
    });
    expectStatus(generatePayroll.status, 403, generatePayroll.raw, 'MESA POST /payroll/generate');

    const createMaterial = await request('/inventory/materials', {
      method: 'POST',
      token: seedMesa.accessToken,
      body: {
        code: materialCode,
        name: 'Forbidden',
        categoryId: '00000000-0000-4000-8000-000000000001',
        unit: 'BOTTLE',
        minimumStock: 1,
        costPrice: 1,
      },
    });
    expectStatus(createMaterial.status, 403, createMaterial.raw, 'MESA POST /inventory/materials');

    const mesaRoster = await request('/daily-registers/mesa-users', {
      token: seedMesa.accessToken,
    });
    expectStatus(
      mesaRoster.status,
      403,
      mesaRoster.raw,
      'MESA GET /daily-registers/mesa-users',
    );
  });

  await check('M1 Auth & RBAC', 'Logout revokes refresh and access (401)', async () => {
    const sessionLogin = await loginWith(ADMIN_CANDIDATES, 'ADMIN session');
    const logout = await request('/auth/logout', {
      method: 'POST',
      token: sessionLogin.accessToken,
      refreshCookie: sessionLogin.refreshCookie,
    });
    expectStatus(logout.status, 204, logout.raw, 'logout');

    const refresh = await request('/auth/refresh', {
      method: 'POST',
      refreshCookie: sessionLogin.refreshCookie,
    });
    expectStatus(refresh.status, 401, refresh.raw, 'refresh revocado');

    const profile = await request('/auth/me', {
      token: sessionLogin.accessToken,
    });
    expectStatus(profile.status, 401, profile.raw, 'access token revocado');
  });

  await check('M1 Auth & RBAC', 'Refresh reuse revokes every session', async () => {
    const first = await loginWith(ADMIN_CANDIDATES, 'ADMIN rotation');
    const second = await loginWith(ADMIN_CANDIDATES, 'ADMIN parallel session');

    const rotated = await request<LoginBody>('/auth/refresh', {
      method: 'POST',
      refreshCookie: first.refreshCookie,
    });
    expectStatus(rotated.status, 200, rotated.raw, 'primera rotacion');

    // Replaying the consumed token outside the rotation grace window must be
    // treated as a stolen token.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const replay = await request('/auth/refresh', {
      method: 'POST',
      refreshCookie: first.refreshCookie,
    });
    expectStatus(replay.status, 401, replay.raw, 'reuso de refresh token');

    const otherSession = await request('/auth/me', {
      token: second.accessToken,
    });
    expectStatus(
      otherSession.status,
      401,
      otherSession.raw,
      'sesion paralela revocada',
    );
  });

  // The reuse check revokes every ADMIN session on purpose, including the one
  // the remaining modules run on.
  admin = await loginWith(ADMIN_CANDIDATES, 'ADMIN');

  console.log('\n💅  M2: Service Catalog');
  let mesaRoleId = '';
  let e2eUserId = '';
  let serviceId = '';

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
        lastName: 'Master',
        email: e2eEmail,
        password: e2ePassword,
        roleIds: [mesaRoleId],
      },
    });
    expectStatus(createdUser.status, 201, createdUser.raw, 'POST /users');
    e2eUserId = createdUser.data.id;
    created.userIds.add(e2eUserId);
  });

  await check('M2 Catalog', 'Temporary password blocks every regular route', async () => {
    const temporary = await request<LoginBody>('/auth/login', {
      method: 'POST',
      body: { email: e2eEmail, password: e2ePassword },
    });
    expectStatus(temporary.status, 200, temporary.raw, 'login temporal');
    expectEqual(
      temporary.data.user.mustChangePassword,
      true,
      'mustChangePassword del usuario nuevo',
    );

    const token = temporary.data.accessToken;

    const blocked = await request('/daily-registers', { token });
    expectStatus(blocked.status, 403, blocked.raw, 'GET /daily-registers bloqueado');
    if (!blocked.raw.includes('contraseña temporal')) {
      throw new CheckError(`Mensaje inesperado: ${blocked.raw.slice(0, 160)}`);
    }

    // The escape hatch has to stay open or the account would be unrecoverable.
    const profile = await request('/auth/me', { token });
    expectStatus(profile.status, 200, profile.raw, 'GET /auth/me permitido');

    const changed = await request('/users/me/password', {
      method: 'PATCH',
      token,
      body: { currentPassword: e2ePassword, newPassword: e2eSettledPassword },
    });
    expectStatus(changed.status, 204, changed.raw, 'PATCH /users/me/password');

    const settled = await request<LoginBody>('/auth/login', {
      method: 'POST',
      body: { email: e2eEmail, password: e2eSettledPassword },
    });
    expectStatus(settled.status, 200, settled.raw, 'login tras el cambio');
    expectEqual(
      settled.data.user.mustChangePassword,
      false,
      'mustChangePassword tras el cambio',
    );

    const allowed = await request('/daily-registers', {
      token: settled.data.accessToken,
    });
    expectStatus(allowed.status, 200, allowed.raw, 'GET /daily-registers liberado');
  });

  await check('M2 Catalog', 'Create service with category, price and commission', async () => {
    const createdService = await request<{
      id: string;
      category: string;
      price: number;
      commissionPercentage: number;
    }>('/services', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        name: serviceName,
        category: 'E2E Master',
        price: listPrice,
        commissionPercentage: listCommissionPct,
      },
    });
    expectStatus(createdService.status, 201, createdService.raw, 'POST /services');
    serviceId = createdService.data.id;
    created.serviceIds.add(serviceId);
    expectEqual(createdService.data.category, 'E2E Master', 'category');
    expectMoney(Number(createdService.data.price), listPrice, 'precio');
    expectMoney(
      Number(createdService.data.commissionPercentage),
      listCommissionPct,
      'commission %',
    );
  });

  await check('M2 Catalog', 'Editing price does not change past tickets', async () => {
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
    created.registerIds.add(snapshot.data.id);
    expectMoney(snapshot.data.details[0].unitPrice, listPrice, 'unitPrice snapshot');

    const updated = await request<{ price: number }>(`/services/${serviceId}`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { price: 40, commissionPercentage: 60 },
    });
    expectStatus(updated.status, 200, updated.raw, 'PATCH servicio');
    expectMoney(Number(updated.data.price), 40, 'updated catalog price');

    const past = await request<RegisterResponse>(
      `/daily-registers/${snapshot.data.id}`,
      { token: admin.accessToken },
    );
    expectStatus(past.status, 200, past.raw, 'GET snapshot');
    expectMoney(past.data.details[0].unitPrice, listPrice, 'snapshot unitPrice intacto');
    expectMoney(past.data.details[0].commissionRate, listCommissionPct, 'snapshot % intacto');
    expectMoney(past.data.details[0].lineCommission, expectedLineCommission, 'snapshot commission unchanged');

    const priceBack = await request(`/services/${serviceId}`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { price: listPrice, commissionPercentage: listCommissionPct },
    });
    expectStatus(priceBack.status, 200, priceBack.raw, 'restaurar precio');
    await voidRegister(admin.accessToken, snapshot.data.id);
  });

  console.log('\nM3: POS & Daily Cash Register');
  let weekdayId = '';

  await check('M3 POS', 'Cash sale', async () => {
    if (!serviceId || !e2eUserId) {
      throw new CheckError('Missing service or MESA user');
    }
    const ticket = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Efectivo`,
        paymentMethod: 'CASH',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(ticket.status, 201, ticket.raw, 'ticket CASH');
    created.registerIds.add(ticket.data.id);
    weekdayId = ticket.data.id;
    expectEqual(ticket.data.paymentMethod, 'CASH', 'method');
    expectMoney(ticket.data.totalPaid, listPrice, 'total CASH');
    expectMoney(ticket.data.cardFeeAmount, 0, 'sin recargo');
    expectMoney(ticket.data.totalCommission, expectedLineCommission, 'CASH commission');
  });

  await check('M3 POS', "MESA cannot read another mesa's ticket", async () => {
    if (!weekdayId) {
      throw new CheckError('Missing ticket id');
    }
    const foreignTicket = await request(`/daily-registers/${weekdayId}`, {
      token: seedMesa.accessToken,
    });
    expectStatus(
      foreignTicket.status,
      403,
      foreignTicket.raw,
      'MESA GET /daily-registers/:id ajeno',
    );
  });

  await check('M3 POS', 'MESA sale is bound to its own userId', async () => {
    if (!serviceId || !e2eUserId) {
      throw new CheckError('Missing service or MESA user');
    }
    const ticket = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: seedMesa.accessToken,
      body: {
        // Spoofed owner: the backend must ignore it and use the JWT subject.
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Mesa propia`,
        paymentMethod: 'CASH',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(ticket.status, 201, ticket.raw, 'ticket MESA');
    created.registerIds.add(ticket.data.id);
    expectEqual(ticket.data.mesaUserId, seedMesa.user.id, 'mesaUserId del JWT');
  });

  await check('M3 POS', 'Transfer sale', async () => {
    if (!serviceId || !e2eUserId) {
      throw new CheckError('Missing service or MESA user');
    }
    const ticket = await request<RegisterResponse>('/daily-registers', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        mesaUserId: e2eUserId,
        clientName: `${MARKER} Transferencia`,
        paymentMethod: 'TRANSFER',
        items: [{ serviceId, quantity: 1 }],
      },
    });
    expectStatus(ticket.status, 201, ticket.raw, 'ticket TRANSFER');
    created.registerIds.add(ticket.data.id);
    expectEqual(ticket.data.paymentMethod, 'TRANSFER', 'method');
    expectMoney(ticket.data.totalPaid, listPrice, 'total TRANSFER');
    expectMoney(ticket.data.cardFeeAmount, 0, 'TRANSFER sin recargo');
    await voidRegister(admin.accessToken, ticket.data.id);
  });

  await check('M3 POS', 'Card sale (+5% surcharge)', async () => {
    if (!serviceId || !e2eUserId) {
      throw new CheckError('Missing service or MESA user');
    }
    const ticket = await request<RegisterResponse>('/daily-registers', {
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
    expectStatus(ticket.status, 201, ticket.raw, 'ticket CARD');
    created.registerIds.add(ticket.data.id);
    expectMoney(ticket.data.cardFeeAmount, money(listPrice * 0.05), 'recargo 5%');
    expectMoney(ticket.data.totalPaid, money(listPrice * 1.05), 'total CARD');
    expectMoney(ticket.data.totalCommission, expectedLineCommission, 'commission without surcharge');
    await voidRegister(admin.accessToken, ticket.data.id);
  });

  await check('M3 POS', 'Discount lowers charge and keeps base commission', async () => {
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

  console.log('\nM4: Vouchers & Advances');
  const payrollAdvanceIds: string[] = [];

  await check('M4 Vouchers', 'Create PENDING voucher and cancel it', async () => {
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
    expectStatus(pending.status, 201, pending.raw, 'POST vale');
    created.advanceIds.add(pending.data.id);
    expectEqual(pending.data.status, 'PENDING', 'PENDING');

    const cancelled = await request<{ status: string }>(
      `/advances/${pending.data.id}/cancel`,
      {
        method: 'PATCH',
        token: admin.accessToken,
        body: { reason: 'Issued by mistake, cancel today.' },
      },
    );
    expectStatus(cancelled.status, 200, cancelled.raw, 'cancel');
    expectEqual(cancelled.data.status, 'CANCELLED', 'CANCELLED');
  });

  await check('M4 Vouchers', 'Accumulated PENDING vouchers for payroll ($10 + $10)', async () => {
    if (!e2eUserId) {
      throw new CheckError('Missing E2E MESA user');
    }
    for (const amount of [10, 10]) {
      const voucher = await request<{ id: string; status: string }>('/advances', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          mesaUserId: e2eUserId,
          amount,
          reason: `${MARKER} Payroll voucher ${amount}`,
        },
      });
      expectStatus(voucher.status, 201, voucher.raw, `POST voucher ${amount}`);
      created.advanceIds.add(voucher.data.id);
      payrollAdvanceIds.push(voucher.data.id);
      expectEqual(voucher.data.status, 'PENDING', 'PENDING');
    }
  });

  console.log('\n📊  M5: Payroll & Weekly Settlement');
  let weekendId = '';
  let payrollId = '';

  await check('M5 Payroll', 'Preview with weekend bonus +5%', async () => {
    if (!serviceId || !e2eUserId || !weekdayId || payrollAdvanceIds.length !== 2) {
      throw new CheckError('Missing payroll inputs');
    }
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
      throw new CheckError('Preview no incluye ticket de efectivo');
    }
    if (!preview.data.registerIds.includes(weekendId)) {
      throw new CheckError('Preview no incluye ticket de fin de semana');
    }
    const expectedBonus = money(listPrice * 0.05);
    const expectedBase = money(expectedLineCommission * 2);
    expectMoney(preview.data.weekendBonusTotal, expectedBonus, 'bono +5%');
    expectMoney(preview.data.baseCommissionTotal, expectedBase, 'base commission');
    expectMoney(preview.data.advancesDeductionTotal, 20, 'vales acumulados');
    expectMoney(preview.data.netPayable, money(expectedBase + expectedBonus - 20), 'neto');
    for (const advanceId of payrollAdvanceIds) {
      if (!preview.data.advanceIds.includes(advanceId)) {
        throw new CheckError(`Preview is missing voucher ${advanceId}`);
      }
    }
  });

  await check(
    'M5 Payroll',
    'Generate stamps tickets, APPLIED vouchers and CLOSED payroll',
    async () => {
      if (!e2eUserId || !weekdayId || !weekendId) {
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

      const [advances, weekdayRow, weekendRow] = await Promise.all([
        prisma.advance.findMany({ where: { id: { in: payrollAdvanceIds } } }),
        prisma.dailyRegister.findUnique({ where: { id: weekdayId } }),
        prisma.dailyRegister.findUnique({ where: { id: weekendId } }),
      ]);
      expectEqual(weekdayRow?.payrollId, payrollId, 'sello ticket laboral');
      expectEqual(weekendRow?.payrollId, payrollId, 'sello ticket weekend');
      for (const advance of advances) {
        expectEqual(advance.status, AdvanceStatus.APPLIED, `voucher ${advance.id} APPLIED`);
        expectEqual(advance.payrollId, payrollId, `voucher ${advance.id} payrollId`);
      }

      const closed = await request<{ status: string }>(`/payroll/${payrollId}/close`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { payrollId },
      });
      expectStatus(closed.status, 200, closed.raw, 'close');
      expectEqual(closed.data.status, PayrollStatus.CLOSED, 'CLOSED');
    },
  );

  await check('M5 Payroll', 'Duplicate payroll blocked (409)', async () => {
    if (!e2eUserId) {
      throw new CheckError('Missing E2E MESA user');
    }
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

  console.log('\nM6: Inventory & Kardex');
  let materialId = '';

  await check('M6 Inventory', 'Create material with initial stock 10.00', async () => {
    const category = await request<{ id: string }>('/inventory/categories', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        name: `E2E-MST Esmaltes ${stamp}`,
        description: 'E2E master category',
      },
    });
    expectStatus(category.status, 201, category.raw, 'create category');
    created.categoryIds.add(category.data.id);

    const material = await request<MaterialResponse>('/inventory/materials', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        code: materialCode,
        name: `${MARKER} Esmalte Rojo`,
        categoryId: category.data.id,
        unit: 'BOTTLE',
        minimumStock: 5,
        costPrice: 4.5,
        initialStock: 10,
      },
    });
    expectStatus(material.status, 201, material.raw, 'create material');
    materialId = material.data.id;
    created.materialIds.add(materialId);
    expectMoney(material.data.currentStock, 10, 'initial stock');

    const detail = await request<{ movements: MovementResponse[] }>(
      `/inventory/materials/${materialId}`,
      { token: admin.accessToken },
    );
    expectStatus(detail.status, 200, detail.raw, 'initial kardex');
    const initialIn = detail.data.movements.find(
      (movement) => movement.type === 'IN' && movement.reason === 'Initial stock',
    );
    if (!initialIn) {
      throw new CheckError('Missing initial-stock IN movement');
    }
  });

  await check('M6 Inventory', 'IN movement +15 → stock 25.00', async () => {
    if (!materialId) {
      throw new CheckError('Missing material');
    }
    const move = await request<MovementResponse>('/inventory/movements', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        materialId,
        type: 'IN',
        quantity: 15,
        reason: `${MARKER} Supplier restock`,
      },
    });
    expectStatus(move.status, 201, move.raw, 'IN');
    expectMoney(move.data.newStock, 25, 'newStock IN');
  });

  await check('M6 Inventory', 'OUT movement and insufficient-stock block (400)', async () => {
    if (!materialId) {
      throw new CheckError('Missing material');
    }
    const out = await request<MovementResponse>('/inventory/movements', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        materialId,
        type: 'OUT',
        quantity: 8,
        reason: `${MARKER} Station consumption`,
      },
    });
    expectStatus(out.status, 201, out.raw, 'OUT');
    expectMoney(out.data.newStock, 17, 'newStock OUT');

    const blocked = await request<{ message?: string }>('/inventory/movements', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        materialId,
        type: 'OUT',
        quantity: 100,
        reason: `${MARKER} Excessive output`,
      },
    });
    expectStatus(blocked.status, 400, blocked.raw, 'excessive OUT');
    const message = String(blocked.data.message ?? blocked.raw).toLowerCase();
    if (!message.includes('insufficient stock')) {
      throw new CheckError(`Unexpected 400 message: ${blocked.raw.slice(0, 200)}`);
    }

    const detail = await request<MaterialResponse>(`/inventory/materials/${materialId}`, {
      token: admin.accessToken,
    });
    expectMoney(detail.data.currentStock, 17, 'stock unchanged');
  });

  await check('M6 Inventory', 'ADJUSTMENT to 4.00 and low-stock alert', async () => {
    if (!materialId) {
      throw new CheckError('Missing material');
    }
    const move = await request<MovementResponse>('/inventory/movements', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        materialId,
        type: 'ADJUSTMENT',
        quantity: 4,
        reason: `${MARKER} Physical count`,
      },
    });
    expectStatus(move.status, 201, move.raw, 'ADJUSTMENT');
    expectMoney(move.data.newStock, 4, 'adjustment newStock');

    const alerts = await request<MaterialResponse[]>('/inventory/materials/low-stock', {
      token: admin.accessToken,
    });
    expectStatus(alerts.status, 200, alerts.raw, 'low-stock');
    const found = alerts.data.find((item) => item.id === materialId);
    if (!found?.isLowStock) {
      throw new CheckError('Material is missing from low-stock');
    }
    expectMoney(found.currentStock, 4, 'alert stock');
  });

  await check('Cleanup', 'Purge E2E artifacts with no leftovers', async () => {
    await cleanupArtifacts();

    const leftoverUsers = await prisma.user.count({
      where: { email: { startsWith: 'e2e.master.' } },
    });
    const leftoverServices = await prisma.service.count({
      where: { name: { startsWith: MARKER } },
    });
    const leftoverRegisters = await prisma.dailyRegister.count({
      where: { clientName: { startsWith: MARKER } },
    });
    const leftoverAdvances = await prisma.advance.count({
      where: { reason: { startsWith: MARKER } },
    });
    const leftoverMaterials = await prisma.material.count({
      where: { code: { startsWith: 'E2E-MST-' } },
    });
    if (
      leftoverUsers ||
      leftoverServices ||
      leftoverRegisters ||
      leftoverAdvances ||
      leftoverMaterials
    ) {
      throw new CheckError(
        `Leftovers: users=${leftoverUsers} services=${leftoverServices} registers=${leftoverRegisters} advances=${leftoverAdvances} materials=${leftoverMaterials}`,
      );
    }
  });

  const failed = printReport();
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
