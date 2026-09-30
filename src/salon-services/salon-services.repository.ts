import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toMoney } from '../common/utils/money.util';
import { SalonServiceSummary } from './interfaces/salon-service.interface';

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  price: Prisma.Decimal;
  commissionPercentage: Prisma.Decimal;
  isActive: boolean;
};

@Injectable()
export class SalonServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(category?: string): Promise<SalonServiceSummary[]> {
    const services = await this.prisma.service.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        ...(category ? { category } : {}),
      },
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        commissionPercentage: true,
        isActive: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return services.map((service) => this.mapToSummary(service));
  }

  async findActiveById(id: string): Promise<SalonServiceSummary | null> {
    const service = await this.prisma.service.findFirst({
      where: {
        id,
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

    return service ? this.mapToSummary(service) : null;
  }

  async findActiveByIds(ids: string[]): Promise<ServiceRow[]> {
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

  private mapToSummary(service: ServiceRow): SalonServiceSummary {
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      price: toMoney(Number(service.price)),
      commissionPercentage: toMoney(Number(service.commissionPercentage)),
      isActive: service.isActive,
    };
  }
}
