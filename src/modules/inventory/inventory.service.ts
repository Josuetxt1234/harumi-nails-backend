import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogStatus,
  InventoryMovementType,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  DEFAULT_SALON_TIMEZONE,
  getZonedDayRange,
  getZonedPeriodRange,
} from '../../common/utils/date.util';
import { toMoney } from '../../common/utils/money.util';
import { PrismaService } from '../../prisma/prisma.service';
import { INVENTORY_ERROR_MESSAGES } from './constants/inventory-errors.constants';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { FilterMaterialsDto } from './dto/filter-materials.dto';
import { FilterMovementsDto } from './dto/filter-movements.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import {
  InventoryCategoryResponse,
  InventoryMovementResponse,
  MaterialDetailResponse,
  MaterialResponse,
  PaginatedMaterials,
  PaginatedMovements,
} from './interfaces/inventory.interface';
import { InventoryRepository } from './inventory.repository';

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createCategory(
    actor: AuthenticatedUser,
    dto: CreateCategoryDto,
  ): Promise<InventoryCategoryResponse> {
    const name = dto.name.trim();
    const existing = await this.inventoryRepository.findCategoryByName(name);
    if (existing) {
      throw new ConflictException(INVENTORY_ERROR_MESSAGES.CATEGORY_NAME_TAKEN);
    }

    return this.inventoryRepository.createCategory({
      name,
      description: dto.description?.trim() ? dto.description.trim() : null,
      status: dto.status ?? CatalogStatus.ACTIVE,
      createdById: actor.id,
    });
  }

  async getCategories(): Promise<InventoryCategoryResponse[]> {
    return this.inventoryRepository.findCategories();
  }

  async createMaterial(
    actor: AuthenticatedUser,
    dto: CreateMaterialDto,
  ): Promise<MaterialResponse> {
    await this.requireCategory(dto.categoryId);

    const code = dto.code.trim().toUpperCase();
    const existingCode = await this.inventoryRepository.findMaterialByCode(code);
    if (existingCode) {
      throw new ConflictException(INVENTORY_ERROR_MESSAGES.MATERIAL_CODE_TAKEN);
    }

    const initialStock = toMoney(dto.initialStock ?? 0);

    try {
      const material = await this.prisma.$transaction(
        async (tx) => {
          const created = await this.inventoryRepository.createMaterial(tx, {
            code,
            name: dto.name.trim(),
            description: dto.description?.trim() ? dto.description.trim() : null,
            categoryId: dto.categoryId,
            unit: dto.unit,
            currentStock: 0,
            minimumStock: toMoney(dto.minimumStock),
            costPrice: toMoney(dto.costPrice),
            createdById: actor.id,
          });

          if (initialStock > 0) {
            await this.applyLockedMovement(tx, {
              materialId: created.id,
              type: InventoryMovementType.IN,
              quantity: initialStock,
              reason: 'Initial stock',
              createdById: actor.id,
            });
            return {
              ...created,
              currentStock: new Prisma.Decimal(initialStock.toFixed(2)),
            };
          }

          return created;
        },
        { maxWait: 10_000, timeout: 20_000 },
      );

      return this.inventoryRepository.mapMaterial(material);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateMaterial(
    id: string,
    actor: AuthenticatedUser,
    dto: UpdateMaterialDto,
  ): Promise<MaterialResponse> {
    const current = await this.inventoryRepository.findMaterialById(id);
    if (!current) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.MATERIAL_NOT_FOUND);
    }

    if (dto.categoryId) {
      await this.requireCategory(dto.categoryId);
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const taken = await this.inventoryRepository.findMaterialByCode(code, id);
      if (taken) {
        throw new ConflictException(INVENTORY_ERROR_MESSAGES.MATERIAL_CODE_TAKEN);
      }
    }

    try {
      const updated = await this.inventoryRepository.updateMaterial(id, {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ? dto.description.trim() : null }
          : {}),
        ...(dto.categoryId !== undefined
          ? { category: { connect: { id: dto.categoryId } } }
          : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.minimumStock !== undefined
          ? { minimumStock: new Prisma.Decimal(toMoney(dto.minimumStock).toFixed(2)) }
          : {}),
        ...(dto.costPrice !== undefined
          ? { costPrice: new Prisma.Decimal(toMoney(dto.costPrice).toFixed(2)) }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        updatedBy: { connect: { id: actor.id } },
      });

      return this.inventoryRepository.mapMaterial(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async getMaterials(query: FilterMaterialsDto): Promise<PaginatedMaterials> {
    return this.inventoryRepository.findMaterials({
      search: query.search?.trim() || undefined,
      categoryId: query.categoryId,
      lowStockOnly: query.lowStockOnly === true,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async getMaterialById(id: string): Promise<MaterialDetailResponse> {
    const material = await this.inventoryRepository.findMaterialById(id);
    if (!material) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.MATERIAL_NOT_FOUND);
    }

    const movements = await this.inventoryRepository.findRecentMovements(id);
    return this.inventoryRepository.mapMaterialDetail(material, movements);
  }

  async getLowStockAlerts(): Promise<MaterialResponse[]> {
    return this.inventoryRepository.findLowStockAlerts();
  }

  async registerMovement(
    actor: AuthenticatedUser,
    dto: CreateMovementDto,
  ): Promise<InventoryMovementResponse> {
    const quantity = toMoney(dto.quantity);
    const reason = dto.reason.trim();

    const movement = await this.prisma.$transaction(
      async (tx) => {
        return this.applyLockedMovement(tx, {
          materialId: dto.materialId,
          type: dto.type,
          quantity,
          reason,
          createdById: actor.id,
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    return this.inventoryRepository.mapMovement(movement);
  }

  async getMovementsHistory(
    query: FilterMovementsDto,
  ): Promise<PaginatedMovements> {
    const { start, end } = this.resolveDateRange(query);

    return this.inventoryRepository.findMovements({
      materialId: query.materialId,
      type: query.type,
      start,
      end,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  private async applyLockedMovement(
    tx: Prisma.TransactionClient,
    input: {
      materialId: string;
      type: InventoryMovementType;
      quantity: number;
      reason: string;
      createdById: string;
    },
  ) {
    const locked = await this.inventoryRepository.lockMaterialById(
      tx,
      input.materialId,
    );

    if (!locked) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.MATERIAL_NOT_FOUND);
    }

    if (locked.status === CatalogStatus.INACTIVE) {
      throw new BadRequestException(INVENTORY_ERROR_MESSAGES.MATERIAL_INACTIVE);
    }

    const previousStock = this.inventoryRepository.toStockNumber(
      locked.currentStock,
    );
    const newStock = this.resolveNewStock(
      input.type,
      previousStock,
      input.quantity,
    );

    await this.inventoryRepository.updateMaterialStock(
      tx,
      locked.id,
      newStock,
    );

    return this.inventoryRepository.createMovement(tx, {
      materialId: locked.id,
      type: input.type,
      quantity: input.quantity,
      previousStock,
      newStock,
      reason: input.reason,
      createdById: input.createdById,
    });
  }

  private resolveNewStock(
    type: InventoryMovementType,
    previousStock: number,
    quantity: number,
  ): number {
    if (type === InventoryMovementType.IN) {
      return toMoney(previousStock + quantity);
    }

    if (type === InventoryMovementType.OUT) {
      if (previousStock < quantity) {
        throw new BadRequestException(
          INVENTORY_ERROR_MESSAGES.INSUFFICIENT_STOCK,
        );
      }
      return toMoney(previousStock - quantity);
    }

    const targetStock = toMoney(quantity);
    if (targetStock < 0) {
      throw new BadRequestException(
        INVENTORY_ERROR_MESSAGES.INVALID_ADJUSTMENT_STOCK,
      );
    }
    return targetStock;
  }

  private async requireCategory(categoryId: string): Promise<void> {
    const category = await this.inventoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }
  }

  private resolveDateRange(query: FilterMovementsDto): {
    start?: Date;
    end?: Date;
  } {
    if (!query.startDate && !query.endDate) {
      return {};
    }

    const timeZone =
      this.configService.get<string>('salonTimezone') ?? DEFAULT_SALON_TIMEZONE;

    try {
      if (query.startDate && query.endDate) {
        return getZonedPeriodRange(
          'CUSTOM',
          timeZone,
          query.startDate,
          query.endDate,
        );
      }

      if (query.startDate) {
        const { startOfDay } = getZonedDayRange(timeZone, query.startDate);
        return { start: startOfDay };
      }

      const { endOfDay } = getZonedDayRange(timeZone, query.endDate);
      return { end: endOfDay };
    } catch {
      throw new BadRequestException(
        INVENTORY_ERROR_MESSAGES.INVALID_DATE_RANGE,
      );
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(INVENTORY_ERROR_MESSAGES.MATERIAL_CODE_TAKEN);
    }
  }
}
