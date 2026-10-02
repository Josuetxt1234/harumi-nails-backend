import { Injectable } from '@nestjs/common';
import {
  CatalogStatus,
  InventoryMovementType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toMoney } from '../../common/utils/money.util';
import {
  InventoryCategoryResponse,
  InventoryMovementResponse,
  ListMaterialsFilters,
  ListMovementsFilters,
  MaterialDetailResponse,
  MaterialResponse,
  PaginatedMaterials,
  PaginatedMovements,
} from './interfaces/inventory.interface';

const materialInclude = {
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.MaterialInclude;

const movementInclude = {
  material: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.InventoryMovementInclude;

type MaterialWithCategory = Prisma.MaterialGetPayload<{
  include: typeof materialInclude;
}>;

type MovementWithRelations = Prisma.InventoryMovementGetPayload<{
  include: typeof movementInclude;
}>;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

type LockedMaterialRow = {
  id: string;
  code: string;
  currentStock: Prisma.Decimal | string | number;
  status: CatalogStatus;
};

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCategoryById(
    id: string,
  ): Promise<InventoryCategoryResponse | null> {
    const category = await this.prisma.inventoryCategory.findUnique({
      where: { id },
    });
    return category ? this.mapCategory(category) : null;
  }

  async findCategoryByName(name: string): Promise<{ id: string } | null> {
    return this.prisma.inventoryCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
  }

  async createCategory(
    data: {
      name: string;
      description: string | null;
      status: CatalogStatus;
      createdById: string;
    },
  ): Promise<InventoryCategoryResponse> {
    const created = await this.prisma.inventoryCategory.create({
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
        createdById: data.createdById,
      },
    });
    return this.mapCategory(created);
  }

  async findCategories(): Promise<InventoryCategoryResponse[]> {
    const categories = await this.prisma.inventoryCategory.findMany({
      orderBy: { name: 'asc' },
    });
    return categories.map((category) => this.mapCategory(category));
  }

  async findMaterialByCode(
    code: string,
    excludeId?: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.material.findFirst({
      where: {
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  }

  async createMaterial(
    client: PrismaClientLike,
    data: {
      code: string;
      name: string;
      description: string | null;
      categoryId: string;
      unit: Prisma.MaterialCreateInput['unit'];
      currentStock: number;
      minimumStock: number;
      costPrice: number;
      createdById: string;
    },
  ): Promise<MaterialWithCategory> {
    return client.material.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        unit: data.unit,
        currentStock: new Prisma.Decimal(data.currentStock.toFixed(2)),
        minimumStock: new Prisma.Decimal(data.minimumStock.toFixed(2)),
        costPrice: new Prisma.Decimal(data.costPrice.toFixed(2)),
        createdById: data.createdById,
      },
      include: materialInclude,
    });
  }

  async lockMaterialById(
    client: Prisma.TransactionClient,
    id: string,
  ): Promise<LockedMaterialRow | null> {
    const rows = await client.$queryRaw<LockedMaterialRow[]>(
      Prisma.sql`SELECT id, code, "currentStock", status FROM materials WHERE id = ${id} FOR UPDATE`,
    );
    return rows[0] ?? null;
  }

  async updateMaterialStock(
    client: Prisma.TransactionClient,
    id: string,
    currentStock: number,
  ): Promise<MaterialWithCategory> {
    return client.material.update({
      where: { id },
      data: {
        currentStock: new Prisma.Decimal(currentStock.toFixed(2)),
      },
      include: materialInclude,
    });
  }

  async updateMaterial(
    id: string,
    data: Prisma.MaterialUpdateInput,
  ): Promise<MaterialWithCategory> {
    return this.prisma.material.update({
      where: { id },
      data,
      include: materialInclude,
    });
  }

  async findMaterialById(
    id: string,
    client: PrismaClientLike = this.prisma,
  ): Promise<MaterialWithCategory | null> {
    return client.material.findUnique({
      where: { id },
      include: materialInclude,
    });
  }

  async findMaterials(filters: ListMaterialsFilters): Promise<PaginatedMaterials> {
    const where: Prisma.MaterialWhereInput = {
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { code: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const materials = await this.prisma.material.findMany({
      where,
      include: materialInclude,
      orderBy: { name: 'asc' },
    });

    const mapped = materials.map((material) => this.mapMaterial(material));
    const filtered = filters.lowStockOnly
      ? mapped.filter((material) => material.isLowStock)
      : mapped;
    const total = filtered.length;
    const skip = (filters.page - 1) * filters.limit;
    const data = filtered.slice(skip, skip + filters.limit);

    return {
      data,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }

  async findLowStockAlerts(): Promise<MaterialResponse[]> {
    const materials = await this.prisma.material.findMany({
      where: { status: CatalogStatus.ACTIVE },
      include: materialInclude,
      orderBy: { name: 'asc' },
    });

    return materials
      .map((material) => this.mapMaterial(material))
      .filter((material) => material.isLowStock);
  }

  async createMovement(
    client: PrismaClientLike,
    data: {
      materialId: string;
      type: InventoryMovementType;
      quantity: number;
      previousStock: number;
      newStock: number;
      reason: string;
      createdById: string;
    },
  ): Promise<MovementWithRelations> {
    return client.inventoryMovement.create({
      data: {
        materialId: data.materialId,
        type: data.type,
        quantity: new Prisma.Decimal(data.quantity.toFixed(2)),
        previousStock: new Prisma.Decimal(data.previousStock.toFixed(2)),
        newStock: new Prisma.Decimal(data.newStock.toFixed(2)),
        reason: data.reason,
        createdById: data.createdById,
      },
      include: movementInclude,
    });
  }

  async findRecentMovements(
    materialId: string,
    take = 50,
  ): Promise<InventoryMovementResponse[]> {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { materialId },
      include: movementInclude,
      orderBy: { createdAt: 'desc' },
      take,
    });
    return movements.map((movement) => this.mapMovement(movement));
  }

  async findMovements(
    filters: ListMovementsFilters,
  ): Promise<PaginatedMovements> {
    const where: Prisma.InventoryMovementWhereInput = {
      ...(filters.materialId ? { materialId: filters.materialId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.start || filters.end
        ? {
            createdAt: {
              ...(filters.start ? { gte: filters.start } : {}),
              ...(filters.end ? { lte: filters.end } : {}),
            },
          }
        : {}),
    };

    const [total, movements] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: movements.map((movement) => this.mapMovement(movement)),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }

  mapMaterial(material: MaterialWithCategory): MaterialResponse {
    const currentStock = toMoney(material.currentStock.toNumber());
    const minimumStock = toMoney(material.minimumStock.toNumber());

    return {
      id: material.id,
      code: material.code,
      name: material.name,
      description: material.description,
      categoryId: material.categoryId,
      categoryName: material.category.name,
      unit: material.unit,
      currentStock,
      minimumStock,
      costPrice: toMoney(material.costPrice.toNumber()),
      status: material.status,
      isLowStock: currentStock <= minimumStock,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
    };
  }

  mapMaterialDetail(
    material: MaterialWithCategory,
    movements: InventoryMovementResponse[],
  ): MaterialDetailResponse {
    return {
      ...this.mapMaterial(material),
      movements,
    };
  }

  mapMovement(movement: MovementWithRelations): InventoryMovementResponse {
    return {
      id: movement.id,
      materialId: movement.materialId,
      materialCode: movement.material.code,
      materialName: movement.material.name,
      type: movement.type,
      quantity: toMoney(movement.quantity.toNumber()),
      previousStock: toMoney(movement.previousStock.toNumber()),
      newStock: toMoney(movement.newStock.toNumber()),
      reason: movement.reason,
      createdById: movement.createdById,
      createdByName:
        `${movement.createdBy.firstName} ${movement.createdBy.lastName}`.trim(),
      createdAt: movement.createdAt,
    };
  }

  private mapCategory(
    category: Prisma.InventoryCategoryGetPayload<object>,
  ): InventoryCategoryResponse {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  toStockNumber(value: Prisma.Decimal | string | number): number {
    if (typeof value === 'number') {
      return toMoney(value);
    }
    if (typeof value === 'string') {
      return toMoney(Number(value));
    }
    return toMoney(value.toNumber());
  }
}
