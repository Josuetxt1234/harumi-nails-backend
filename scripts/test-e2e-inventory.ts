import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

const prisma = new PrismaClient();
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3000';
const api = request(API_BASE);

const ADMIN_CANDIDATES = [
  { email: 'admin@haruminails.com', password: 'Admin123!' },
  { email: 'admin@harumi.com', password: 'Admin1234*' },
];

const MESA_CANDIDATES = [
  { email: 'mesa10@haruminails.com', password: 'Mesa1234!' },
  { email: 'gabriela.rios@harumi.com', password: 'Admin1234*' },
];

const CATEGORY_NAME = 'Esmaltes';
const MATERIAL_NAME = 'Esmalte Semi-Permanente Rojo';
const MATERIAL_CODE = `E2E-INV-${Date.now().toString(36).toUpperCase()}`;

type LoginResponse = {
  accessToken: string;
  user: { id: string; roles: string[]; permissions: string[] };
};

type CategoryResponse = {
  id: string;
  name: string;
};

type MaterialResponse = {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  minimumStock: number;
  costPrice: number;
  isLowStock: boolean;
};

type MovementResponse = {
  id: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
};

type MaterialDetailResponse = MaterialResponse & {
  movements: MovementResponse[];
};

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const checks: CheckResult[] = [];
const created = {
  categoryId: null as string | null,
  createdCategory: false,
  materialId: null as string | null,
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

function errorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return '';
  }
  const message = (body as { message?: string | string[] }).message;
  if (Array.isArray(message)) {
    return message.join(' ');
  }
  return typeof message === 'string' ? message : '';
}

function expectStatus(
  actual: number,
  expected: number,
  body: unknown,
  label: string,
): void {
  if (actual !== expected) {
    throw new CheckError(
      `${label}: HTTP ${actual} (expected ${expected}) ${JSON.stringify(body).slice(0, 280)}`,
    );
  }
}

function expectMoney(actual: number, expected: number, label: string): void {
  if (money(Number(actual)) !== money(expected)) {
    throw new CheckError(`${label}: expected ${expected.toFixed(2)}, got ${actual}`);
  }
}

async function login(
  candidates: Array<{ email: string; password: string }>,
  label: string,
): Promise<LoginResponse> {
  let lastError = `Could not authenticate ${label}`;

  for (const candidate of candidates) {
    const response = await api.post('/api/auth/login').send({
      email: candidate.email,
      password: candidate.password,
    });
    if (response.status === 200 && response.body?.accessToken) {
      return response.body as LoginResponse;
    }
    lastError = `${label} ${candidate.email}: HTTP ${response.status}`;
  }

  throw new CheckError(lastError);
}

async function runCheck(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`  ✔️  ${name}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    checks.push({ name, ok: false, detail });
    console.log(`  ❌  ${name}`);
    console.log(`      ${detail}`);
  }
}

async function cleanupArtifacts(): Promise<void> {
  const leftoverMaterials = await prisma.material.findMany({
    where: {
      OR: [
        ...(created.materialId ? [{ id: created.materialId }] : []),
        { code: { startsWith: 'E2E-INV-' } },
      ],
    },
    select: { id: true },
  });
  const materialIds = leftoverMaterials.map((row) => row.id);

  if (materialIds.length > 0) {
    await prisma.inventoryMovement.deleteMany({
      where: { materialId: { in: materialIds } },
    });
    await prisma.material.deleteMany({
      where: { id: { in: materialIds } },
    });
  }

  if (created.createdCategory && created.categoryId) {
    const remaining = await prisma.material.count({
      where: { categoryId: created.categoryId },
    });
    if (remaining === 0) {
      await prisma.inventoryCategory.delete({
        where: { id: created.categoryId },
      });
    }
  }
}

async function main(): Promise<void> {
  console.log('\nE2E Materials Inventory');
  console.log(`    API ${API_BASE}\n`);

  const admin = await login(ADMIN_CANDIDATES, 'ADMIN');
  const mesa = await login(MESA_CANDIDATES, 'MESA');

  await runCheck('1. RBAC & authentication', async () => {
    const mesaCreate = await api
      .post('/api/inventory/materials')
      .set('Authorization', `Bearer ${mesa.accessToken}`)
      .send({
        code: MATERIAL_CODE,
        name: MATERIAL_NAME,
        categoryId: '00000000-0000-4000-8000-000000000001',
        unit: 'BOTTLE',
        minimumStock: 5,
        costPrice: 4.5,
        initialStock: 10,
      });
    expectStatus(mesaCreate.status, 403, mesaCreate.body, 'MESA create material');

    const mesaMove = await api
      .post('/api/inventory/movements')
      .set('Authorization', `Bearer ${mesa.accessToken}`)
      .send({
        materialId: '00000000-0000-4000-8000-000000000001',
        type: 'IN',
        quantity: 1,
        reason: 'Intento no autorizado',
      });
    expectStatus(mesaMove.status, 403, mesaMove.body, 'MESA registrar movimiento');

    const anonymous = await api.get('/api/inventory/materials');
    expectStatus(anonymous.status, 401, anonymous.body, 'request without token');
  });

  await runCheck('2. Category, material and initial stock', async () => {
    const createCategory = await api
      .post('/api/inventory/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        name: CATEGORY_NAME,
        description: 'E2E nail polish category',
      });

    if (createCategory.status === 201) {
      created.categoryId = (createCategory.body as CategoryResponse).id;
      created.createdCategory = true;
    } else if (createCategory.status === 409) {
      const list = await api
        .get('/api/inventory/categories')
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expectStatus(list.status, 200, list.body, 'list categories');
      const existing = (list.body as CategoryResponse[]).find(
        (category) => category.name.toLowerCase() === CATEGORY_NAME.toLowerCase(),
      );
      if (!existing) {
        throw new CheckError('Esmaltes category conflicts but is missing from the list');
      }
      created.categoryId = existing.id;
    } else {
      expectStatus(createCategory.status, 201, createCategory.body, 'create category');
    }

    if (!created.categoryId) {
      throw new CheckError('No se obtuvo categoryId');
    }

    const createMaterial = await api
      .post('/api/inventory/materials')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        code: MATERIAL_CODE,
        name: MATERIAL_NAME,
        description: 'Insumo E2E',
        categoryId: created.categoryId,
        unit: 'BOTTLE',
        minimumStock: 5,
        costPrice: 4.5,
        initialStock: 10,
      });
    expectStatus(createMaterial.status, 201, createMaterial.body, 'create material');

    const material = createMaterial.body as MaterialResponse;
    created.materialId = material.id;
    expectMoney(material.currentStock, 10, 'initial currentStock');
    expectMoney(material.minimumStock, 5, 'minimumStock');
    expectMoney(material.costPrice, 4.5, 'costPrice');

    const detail = await api
      .get(`/api/inventory/materials/${material.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expectStatus(detail.status, 200, detail.body, 'initial kardex');
    const kardex = detail.body as MaterialDetailResponse;
    const initialIn = kardex.movements.find(
      (movement) => movement.type === 'IN' && movement.reason === 'Initial stock',
    );
    if (!initialIn) {
      throw new CheckError('Missing initial-stock IN movement in kardex');
    }
    expectMoney(initialIn.quantity, 10, 'initial stock quantity');
    expectMoney(initialIn.newStock, 10, 'initial stock newStock');
  });

  await runCheck('3. Movimiento ENTRADA (IN)', async () => {
    if (!created.materialId) {
      throw new CheckError('Missing test material');
    }

    const move = await api
      .post('/api/inventory/movements')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        materialId: created.materialId,
        type: 'IN',
        quantity: 15,
        reason: 'Compra de lote a proveedor',
      });
    expectStatus(move.status, 201, move.body, 'entrada IN');
    const body = move.body as MovementResponse;
    expectMoney(body.newStock, 25, 'newStock IN');

    const detail = await api
      .get(`/api/inventory/materials/${created.materialId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expectStatus(detail.status, 200, detail.body, 'stock tras IN');
    expectMoney((detail.body as MaterialResponse).currentStock, 25, 'currentStock tras IN');
  });

  await runCheck('4. Movimiento SALIDA (OUT)', async () => {
    if (!created.materialId) {
      throw new CheckError('Missing test material');
    }

    const move = await api
      .post('/api/inventory/movements')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        materialId: created.materialId,
        type: 'OUT',
        quantity: 8,
        reason: 'Consumo en mesa semana 1',
      });
    expectStatus(move.status, 201, move.body, 'salida OUT');
    expectMoney((move.body as MovementResponse).newStock, 17, 'newStock OUT');

    const detail = await api
      .get(`/api/inventory/materials/${created.materialId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expectStatus(detail.status, 200, detail.body, 'stock tras OUT');
    expectMoney((detail.body as MaterialResponse).currentStock, 17, 'currentStock tras OUT');
  });

  await runCheck('5. Insufficient-stock block', async () => {
    if (!created.materialId) {
      throw new CheckError('Missing test material');
    }

    const move = await api
      .post('/api/inventory/movements')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        materialId: created.materialId,
        type: 'OUT',
        quantity: 100,
        reason: 'Intento de salida excesiva E2E',
      });
    expectStatus(move.status, 400, move.body, 'OUT excesiva');
    const message = errorMessage(move.body);
    if (!message.toLowerCase().includes('insufficient stock')) {
      throw new CheckError(`Mensaje 400 inesperado: ${message || JSON.stringify(move.body)}`);
    }

    const detail = await api
      .get(`/api/inventory/materials/${created.materialId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expectStatus(detail.status, 200, detail.body, 'stock intacto');
    expectMoney((detail.body as MaterialResponse).currentStock, 17, 'stock unchanged');
  });

  await runCheck('6. Movimiento AJUSTE (ADJUSTMENT)', async () => {
    if (!created.materialId) {
      throw new CheckError('Missing test material');
    }

    const move = await api
      .post('/api/inventory/movements')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        materialId: created.materialId,
        type: 'ADJUSTMENT',
        quantity: 4,
        reason: 'Monthly physical-count adjustment',
      });
    expectStatus(move.status, 201, move.body, 'ajuste');
    expectMoney((move.body as MovementResponse).newStock, 4, 'newStock ajuste');

    const detail = await api
      .get(`/api/inventory/materials/${created.materialId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expectStatus(detail.status, 200, detail.body, 'stock tras ajuste');
    expectMoney((detail.body as MaterialResponse).currentStock, 4, 'currentStock ajuste');
  });

  await runCheck('7. Alerta de stock bajo (low-stock)', async () => {
    if (!created.materialId) {
      throw new CheckError('Missing test material');
    }

    const alerts = await api
      .get('/api/inventory/materials/low-stock')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expectStatus(alerts.status, 200, alerts.body, 'low-stock');
    const items = alerts.body as MaterialResponse[];
    const found = items.find((item) => item.id === created.materialId);
    if (!found) {
      throw new CheckError('E2E material is missing from /materials/low-stock');
    }
    if (!found.isLowStock) {
      throw new CheckError('isLowStock should be true when stock 4.00 <= minimum 5.00');
    }
    expectMoney(found.currentStock, 4, 'currentStock in alert');
    expectMoney(found.minimumStock, 5, 'minimumStock in alert');
  });

  await runCheck('8. Automatic cleanup', async () => {
    await cleanupArtifacts();

    if (created.materialId) {
      const leftover = await prisma.material.findUnique({
        where: { id: created.materialId },
      });
      if (leftover) {
        throw new CheckError('Test material is still in the database');
      }
      const movements = await prisma.inventoryMovement.count({
        where: { materialId: created.materialId },
      });
      if (movements > 0) {
        throw new CheckError('Test movements were left in the database');
      }
    }

    if (created.createdCategory && created.categoryId) {
      const leftoverCategory = await prisma.inventoryCategory.findUnique({
        where: { id: created.categoryId },
      });
      if (leftoverCategory) {
        throw new CheckError('Test category is still in the database');
      }
    }
  });

  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.filter((check) => !check.ok).length;

  console.log('\n📋  Resumen inventario E2E');
  for (const check of checks) {
    console.log(`    ${check.ok ? '✔️' : '❌'}  ${check.name}`);
  }
  console.log(`\n    Total: ${passed} ✔️  ${failed} ❌\n`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(async (error) => {
    console.error('\n❌  Fallo no controlado:', error);
    process.exitCode = 1;
    try {
      await cleanupArtifacts();
    } catch (cleanupError) {
      console.error('Residual cleanup failed:', cleanupError);
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
