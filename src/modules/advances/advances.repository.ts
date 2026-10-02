import { Injectable } from '@nestjs/common';
import { AdvanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toMoney } from '../../common/utils/money.util';
import {
  AdvanceResponse,
  CancelAdvanceData,
  CreateAdvanceData,
  ListAdvancesFilters,
  PaginatedAdvances,
} from './interfaces/advance.interface';

const advanceInclude = {
  mesaUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  cancelledBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.AdvanceInclude;

type AdvanceWithRelations = Prisma.AdvanceGetPayload<{
  include: typeof advanceInclude;
}>;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AdvancesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveMesaUserById(userId: string): Promise<{
    id: string;
    isActive: boolean;
  } | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
      select: {
        id: true,
        isActive: true,
      },
    });
  }

  async create(
    client: PrismaClientLike,
    data: CreateAdvanceData,
  ): Promise<AdvanceResponse> {
    const created = await client.advance.create({
      data: {
        mesaUserId: data.mesaUserId,
        amount: new Prisma.Decimal(data.amount.toFixed(2)),
        reason: data.reason,
        date: data.date,
        status: AdvanceStatus.PENDING,
        createdById: data.createdById,
      },
      include: advanceInclude,
    });

    return this.mapToResponse(created);
  }

  async findMany(filters: ListAdvancesFilters): Promise<PaginatedAdvances> {
    const where: Prisma.AdvanceWhereInput = {
      isDeleted: false,
      ...(filters.mesaUserId ? { mesaUserId: filters.mesaUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.start || filters.end
        ? {
            date: {
              ...(filters.start ? { gte: filters.start } : {}),
              ...(filters.end ? { lte: filters.end } : {}),
            },
          }
        : {}),
    };

    const [total, advances] = await this.prisma.$transaction([
      this.prisma.advance.count({ where }),
      this.prisma.advance.findMany({
        where,
        include: advanceInclude,
        orderBy: { date: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: advances.map((advance: AdvanceWithRelations) =>
        this.mapToResponse(advance),
      ),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }

  async findActiveById(
    client: PrismaClientLike,
    id: string,
  ): Promise<{
    id: string;
    status: AdvanceStatus;
    createdAt: Date;
  } | null> {
    return client.advance.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async cancel(
    client: PrismaClientLike,
    id: string,
    data: CancelAdvanceData,
  ): Promise<AdvanceResponse> {
    const updated = await client.advance.update({
      where: { id },
      data: {
        status: AdvanceStatus.CANCELLED,
        cancellationReason: data.cancellationReason,
        cancelledAt: data.cancelledAt,
        cancelledByUserId: data.cancelledByUserId,
      },
      include: advanceInclude,
    });

    return this.mapToResponse(updated);
  }

  async softDelete(client: PrismaClientLike, id: string): Promise<void> {
    await client.advance.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });
  }

  private mapToResponse(advance: AdvanceWithRelations): AdvanceResponse {
    return {
      id: advance.id,
      mesaUserId: advance.mesaUserId,
      mesaUserName:
        `${advance.mesaUser.firstName} ${advance.mesaUser.lastName}`.trim(),
      amount: toMoney(advance.amount.toNumber()),
      reason: advance.reason,
      date: advance.date,
      status: advance.status,
      payrollId: advance.payrollId,
      createdById: advance.createdById,
      createdByName:
        `${advance.createdBy.firstName} ${advance.createdBy.lastName}`.trim(),
      cancellationReason: advance.cancellationReason,
      cancelledAt: advance.cancelledAt,
      cancelledByUserId: advance.cancelledByUserId,
      cancelledByName: advance.cancelledBy
        ? `${advance.cancelledBy.firstName} ${advance.cancelledBy.lastName}`.trim()
        : null,
      createdAt: advance.createdAt,
      updatedAt: advance.updatedAt,
    };
  }
}
