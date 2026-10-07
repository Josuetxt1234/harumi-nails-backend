import { AdvanceStatus, PayrollStatus, PrismaClient } from '@prisma/client';
import {
  seedAdminAccount,
  seedMesaAccount,
} from '../prisma/seed-credentials';

const prisma = new PrismaClient();
const API = 'http://localhost:3000/api';

type LoginResponse = {
  accessToken: string;
  user: { id: string; roles: string[]; permissions: string[] };
};

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    expectedStatus?: number;
  } = {},
): Promise<{ status: number; data: T }> {
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
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (options.expectedStatus && response.status !== options.expectedStatus) {
    throw new Error(
      `${path} expected ${options.expectedStatus}, got ${response.status}: ${text}`,
    );
  }

  return { status: response.status, data };
}

async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    expectedStatus: 200,
  });
  return data;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function main(): Promise<void> {
  const failures: string[] = [];
  const adminAccount = seedAdminAccount();
  const admin = await login(adminAccount.email, adminAccount.password);
  const requiredAdmin = [
    'advances.create',
    'advances.cancel',
    'payroll.create',
    'payroll.close',
    'daily_registers.create',
  ];
  for (const permission of requiredAdmin) {
    if (!admin.user.permissions.includes(permission)) {
      failures.push(`Admin JWT missing ${permission}`);
    }
  }

  const mesaAccount = seedMesaAccount();
  const mesa = await login(mesaAccount.email, mesaAccount.password);
  if (!mesa.user.permissions.includes('payroll.read')) {
    failures.push('MESA JWT missing payroll.read');
  }
  if (!mesa.user.permissions.includes('advances.read')) {
    failures.push('MESA JWT missing advances.read');
  }

  const mesaUsers = await request<
    Array<{ id: string; firstName: string; lastName: string }>
  >('/daily-registers/mesa-users', { token: admin.accessToken, expectedStatus: 200 });
  const weekStart = new Date('2026-09-26T05:00:00.000Z');
  const weekEnd = new Date('2026-10-03T04:59:59.999Z');
  const closedThisWeek = await prisma.payroll.findMany({
    where: {
      isDeleted: false,
      status: { in: ['CLOSED', 'PAID'] },
      periodStart: weekStart,
      periodEnd: weekEnd,
    },
    select: { mesaUserId: true },
  });
  const blocked = new Set(closedThisWeek.map((row) => row.mesaUserId));
  const target =
    mesaUsers.data.find((user) => user.id === mesa.user.id && !blocked.has(user.id)) ??
    mesaUsers.data.find((user) => !blocked.has(user.id));
  if (!target) {
    throw new Error('No free MESA user is available to settle this week');
  }

  const services = await request<{
    data: Array<{ id: string; name: string; price: number }>;
  }>('/services?isActive=true&limit=20', {
    token: admin.accessToken,
    expectedStatus: 200,
  });
  const service = services.data.data[0];
  if (!service) {
    throw new Error('No active services');
  }

  const weekday = await request<{
    id: string;
    totalPaid: number;
    totalCommission: number;
    details: Array<{ lineSubtotal: number; lineCommission: number }>;
  }>('/daily-registers', {
    method: 'POST',
    token: admin.accessToken,
    expectedStatus: 201,
    body: {
      mesaUserId: target.id,
      clientName: 'E2E Semana',
      paymentMethod: 'CASH',
      items: [{ serviceId: service.id, quantity: 1 }],
    },
  });

  const weekend = await request<{
    id: string;
    totalPaid: number;
    totalCommission: number;
    details: Array<{ lineSubtotal: number; lineCommission: number }>;
  }>('/daily-registers', {
    method: 'POST',
    token: admin.accessToken,
    expectedStatus: 201,
    body: {
      mesaUserId: target.id,
      clientName: 'E2E Fin de semana',
      paymentMethod: 'CASH',
      items: [{ serviceId: service.id, quantity: 1 }],
    },
  });

  await prisma.dailyRegister.update({
    where: { id: weekend.data.id },
    data: { createdAt: new Date('2026-09-26T17:00:00.000Z') },
  });

  const advance = await request<{
    id: string;
    status: string;
    amount: number;
    payrollId: string | null;
  }>('/advances', {
    method: 'POST',
    token: admin.accessToken,
    expectedStatus: 201,
    body: {
      mesaUserId: target.id,
      amount: 20,
      reason: 'E2E adelanto 20',
    },
  });

  if (advance.data.status !== 'PENDING') {
    failures.push(`Advance status expected PENDING, got ${advance.data.status}`);
  }

  const preview = await request<{
    grossSales: number;
    baseCommissionTotal: number;
    weekendBonusTotal: number;
    advancesDeductionTotal: number;
    netPayable: number;
    registerIds: string[];
    advanceIds: string[];
  }>('/payroll/preview', {
    method: 'POST',
    token: admin.accessToken,
    expectedStatus: 201,
    body: {
      mesaUserId: target.id,
      periodStart: '2026-09-26',
      periodEnd: '2026-10-02',
    },
  });

  const expectedBase = money(
    weekday.data.totalCommission + weekend.data.totalCommission,
  );
  const expectedBonus = money(weekend.data.details[0].lineSubtotal * 0.05);
  const expectedNet = money(expectedBase + expectedBonus - 20);

  if (!preview.data.registerIds.includes(weekday.data.id)) {
    failures.push('Preview missing weekday register');
  }
  if (!preview.data.registerIds.includes(weekend.data.id)) {
    failures.push('Preview missing weekend register');
  }
  if (preview.data.weekendBonusTotal !== expectedBonus) {
    failures.push(
      `Bonus expected ${expectedBonus}, got ${preview.data.weekendBonusTotal}`,
    );
  }
  if (preview.data.advancesDeductionTotal !== 20) {
    failures.push(
      `Advances expected 20, got ${preview.data.advancesDeductionTotal}`,
    );
  }
  if (preview.data.netPayable !== expectedNet) {
    failures.push(
      `Net expected ${expectedNet}, got ${preview.data.netPayable}`,
    );
  }

  const generated = await request<{ id: string; status: string }>(
    '/payroll/generate',
    {
      method: 'POST',
      token: admin.accessToken,
      expectedStatus: 201,
      body: {
        mesaUserId: target.id,
        periodStart: '2026-09-26',
        periodEnd: '2026-10-02',
      },
    },
  );

  const appliedAdvance = await prisma.advance.findUnique({
    where: { id: advance.data.id },
  });
  const weekdayLinked = await prisma.dailyRegister.findUnique({
    where: { id: weekday.data.id },
  });
  const weekendLinked = await prisma.dailyRegister.findUnique({
    where: { id: weekend.data.id },
  });

  if (appliedAdvance?.status !== AdvanceStatus.APPLIED) {
    failures.push(`Advance after generate: ${appliedAdvance?.status}`);
  }
  if (appliedAdvance?.payrollId !== generated.data.id) {
    failures.push('Advance payrollId mismatch');
  }
  if (weekdayLinked?.payrollId !== generated.data.id) {
    failures.push('Weekday register payrollId missing');
  }
  if (weekendLinked?.payrollId !== generated.data.id) {
    failures.push('Weekend register payrollId missing');
  }

  const cancelAttempt = await request<{ message?: string }>(
    `/advances/${advance.data.id}/cancel`,
    {
      method: 'PATCH',
      token: admin.accessToken,
      body: { reason: 'Attempt to cancel an applied voucher.' },
    },
  );
  if (cancelAttempt.status !== 400) {
    failures.push(`Cancel APPLIED expected 400, got ${cancelAttempt.status}`);
  }

  const deleteAttempt = await request<{ message?: string }>(
    `/advances/${advance.data.id}`,
    { method: 'DELETE', token: admin.accessToken },
  );
  if (deleteAttempt.status !== 400) {
    failures.push(`Delete APPLIED expected 400, got ${deleteAttempt.status}`);
  }

  const mesaForbiddenGenerate = await request('/payroll/generate', {
    method: 'POST',
    token: mesa.accessToken,
    body: { mesaUserId: target.id },
  });
  if (mesaForbiddenGenerate.status !== 403) {
    failures.push(
      `MESA generate expected 403, got ${mesaForbiddenGenerate.status}`,
    );
  }

  const myAdvances = await request<{
    data: Array<{ id: string; mesaUserId: string }>;
  }>('/advances/me', { token: mesa.accessToken, expectedStatus: 200 });
  if (myAdvances.data.data.some((item) => item.mesaUserId !== mesa.user.id)) {
    failures.push('MESA /advances/me leaked another mesa');
  }

  const myPayrolls = await request<{
    data: Array<{ id: string; mesaUserId: string }>;
  }>('/payroll/me', { token: mesa.accessToken, expectedStatus: 200 });
  if (myPayrolls.data.data.some((item) => item.mesaUserId !== mesa.user.id)) {
    failures.push('MESA /payroll/me leaked another mesa');
  }

  const closed = await request<{ id: string; status: string }>(
    `/payroll/${generated.data.id}/close`,
    {
      method: 'PATCH',
      token: admin.accessToken,
      expectedStatus: 200,
      body: { payrollId: generated.data.id },
    },
  );
  if (closed.data.status !== PayrollStatus.CLOSED) {
    failures.push(`Close expected CLOSED, got ${closed.data.status}`);
  }

  const regenerate = await request<{ message?: string }>('/payroll/generate', {
    method: 'POST',
    token: admin.accessToken,
    body: {
      mesaUserId: target.id,
      periodStart: '2026-09-26',
      periodEnd: '2026-10-02',
    },
  });
  if (regenerate.status !== 409) {
    failures.push(`Second generate expected 409, got ${regenerate.status}`);
  }

  if (failures.length > 0) {
    console.error('E2E FAILURES:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mesaUserId: target.id,
        weekdayRegisterId: weekday.data.id,
        weekendRegisterId: weekend.data.id,
        advanceId: advance.data.id,
        payrollId: generated.data.id,
        preview: preview.data,
        expected: {
          base: expectedBase,
          bonus: expectedBonus,
          advances: 20,
          net: expectedNet,
        },
        cancelStatus: cancelAttempt.status,
        deleteStatus: deleteAttempt.status,
        mesaGenerateStatus: mesaForbiddenGenerate.status,
        regenerateStatus: regenerate.status,
        closedStatus: closed.data.status,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
