import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toMoney } from '../common/utils/money.util';
import {
  CreateServiceData,
  ListServicesFilters,
  PaginatedSalonServices,
  SalonServiceSummary,
  UpdateServiceData,
} from './interfaces/salon-service.interface';

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  price: Prisma.Decimal;
  commissionPercentage: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const SERVICE_SELECT = {
  id: true,
  name: true,
  category: true,
  price: true,
  commissionPercentage: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class SalonServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ListServicesFilters): Promise<PaginatedSalonServices> {
    const where: Prisma.ServiceWhereInput = {
      isDeleted: false,
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
              {
                category: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [total, services] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        select: SERVICE_SELECT,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: services.map((service) => this.mapToSummary(service)),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }

  async findById(id: string): Promise<SalonServiceSummary | null> {
    const service = await this.prisma.service.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: SERVICE_SELECT,
    });

    return service ? this.mapToSummary(service) : null;
  }

  async findActiveByIds(ids: string[]): Promise<
    Array<{
      id: string;
      name: string;
      category: string;
      price: Prisma.Decimal;
      commissionPercentage: Prisma.Decimal;
      isActive: boolean;
    }>
  > {
    return this.prisma.service.findMany({
      where: {
        id: { in: ids },
        isDeleted: false,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        commissionPercentage: true,
        isActive: true,
      },
    });
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const service = await this.prisma.service.findFirst({
      where: {
        name,
        isDeleted: false,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    return Boolean(service);
  }

  async create(data: CreateServiceData): Promise<SalonServiceSummary> {
    const service = await this.prisma.service.create({
      data: {
        name: data.name,
        category: data.category,
        price: new Prisma.Decimal(data.price.toFixed(2)),
        commissionPercentage: new Prisma.Decimal(
          data.commissionPercentage.toFixed(2),
        ),
        createdById: data.createdById,
      },
      select: SERVICE_SELECT,
    });

    return this.mapToSummary(service);
  }

  async update(
    id: string,
    data: UpdateServiceData,
  ): Promise<SalonServiceSummary> {
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.price !== undefined
          ? { price: new Prisma.Decimal(data.price.toFixed(2)) }
          : {}),
        ...(data.commissionPercentage !== undefined
          ? {
              commissionPercentage: new Prisma.Decimal(
                data.commissionPercentage.toFixed(2),
              ),
            }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedById: data.updatedById,
      },
      select: SERVICE_SELECT,
    });

    return this.mapToSummary(service);
  }

  async softDelete(id: string, deletedById: string): Promise<void> {
    await this.prisma.service.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
        deletedById,
      },
    });
  }

  private mapToSummary(service: ServiceRow): SalonServiceSummary {
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      price: toMoney(service.price.toNumber()),
      commissionPercentage: toMoney(service.commissionPercentage.toNumber()),
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}
