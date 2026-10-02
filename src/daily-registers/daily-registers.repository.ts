import { Injectable } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toMoney } from '../common/utils/money.util';
import {
  CreateDailyRegisterData,
  DailyRegisterResponse,
  ListDailyRegistersFilters,
  PaginatedDailyRegisters,
  TodayRegistersFilters,
} from './interfaces/daily-register.interface';

const registerInclude = {
  details: {
    include: {
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
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
} satisfies Prisma.DailyRegisterInclude;

type RegisterWithRelations = Prisma.DailyRegisterGetPayload<{
  include: typeof registerInclude;
}>;

@Injectable()
export class DailyRegistersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDailyRegisterData): Promise<DailyRegisterResponse> {
    const created = await this.prisma.$transaction(async (tx) => {
      return tx.dailyRegister.create({
        data: {
          clientName: data.clientName,
          paymentMethod: data.paymentMethod,
          subtotalBase: new Prisma.Decimal(data.subtotalBase.toFixed(2)),
          discountAmount: new Prisma.Decimal(data.discountAmount.toFixed(2)),
          cardFeeAmount: new Prisma.Decimal(data.cardFeeAmount.toFixed(2)),
          totalPaid: new Prisma.Decimal(data.totalPaid.toFixed(2)),
          totalCommission: new Prisma.Decimal(data.totalCommission.toFixed(2)),
          mesaUserId: data.mesaUserId,
          createdById: data.createdById,
          details: {
            create: data.details.map((detail) => ({
              serviceId: detail.serviceId,
              unitPrice: new Prisma.Decimal(detail.unitPrice.toFixed(2)),
              commissionRate: new Prisma.Decimal(
                detail.commissionRate.toFixed(2),
              ),
              quantity: detail.quantity,
              lineSubtotal: new Prisma.Decimal(detail.lineSubtotal.toFixed(2)),
              lineCommission: new Prisma.Decimal(
                detail.lineCommission.toFixed(2),
              ),
            })),
          },
        },
        include: registerInclude,
      });
    });

    return this.mapToResponse(created);
  }

  async findToday(
    filters: TodayRegistersFilters,
  ): Promise<DailyRegisterResponse[]> {
    const registers = await this.prisma.dailyRegister.findMany({
      where: {
        isDeleted: false,
        createdAt: {
          gte: filters.startOfDay,
          lte: filters.endOfDay,
        },
        ...(filters.mesaUserId ? { mesaUserId: filters.mesaUserId } : {}),
      },
      include: registerInclude,
      orderBy: { createdAt: 'desc' },
    });

    return registers.map((register) => this.mapToResponse(register));
  }

  async findMany(
    filters: ListDailyRegistersFilters,
  ): Promise<PaginatedDailyRegisters> {
    const where: Prisma.DailyRegisterWhereInput = {
      isDeleted: false,
      createdAt: {
        gte: filters.start,
        lte: filters.end,
      },
      ...(filters.mesaUserId ? { mesaUserId: filters.mesaUserId } : {}),
      ...(filters.paymentMethod
        ? { paymentMethod: filters.paymentMethod }
        : {}),
    };

    const [total, registers, moneyAgg, servicesAgg] =
      await this.prisma.$transaction([
        this.prisma.dailyRegister.count({ where }),
        this.prisma.dailyRegister.findMany({
          where,
          include: registerInclude,
          orderBy: { createdAt: 'desc' },
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
        }),
        this.prisma.dailyRegister.aggregate({
          where,
          _sum: {
            totalPaid: true,
            totalCommission: true,
          },
        }),
        this.prisma.dailyRegisterDetail.aggregate({
          where: {
            dailyRegister: where,
          },
          _sum: {
            quantity: true,
          },
        }),
      ]);

    return {
      data: registers.map((register) => this.mapToResponse(register)),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
        totalPaid: toMoney(Number(moneyAgg._sum.totalPaid ?? 0)),
        totalCommission: toMoney(Number(moneyAgg._sum.totalCommission ?? 0)),
        servicesCount: servicesAgg._sum.quantity ?? 0,
      },
    };
  }

  async findActiveById(id: string): Promise<DailyRegisterResponse | null> {
    const register = await this.prisma.dailyRegister.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: registerInclude,
    });

    return register ? this.mapToResponse(register) : null;
  }

  async softDelete(id: string, deletedById: string): Promise<void> {
    await this.prisma.dailyRegister.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
      },
    });
  }

  async findActiveMesaUsers(): Promise<
    Array<{ id: string; firstName: string; lastName: string }>
  > {
    const users = await this.prisma.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        roles: {
          some: {
            isDeleted: false,
            role: {
              name: 'MESA',
              isDeleted: false,
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return users;
  }

  async findActiveMesaUserById(userId: string): Promise<{
    id: string;
    roles: string[];
  } | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
        isActive: true,
      },
      select: {
        id: true,
        roles: {
          where: { isDeleted: false },
          select: {
            role: {
              select: {
                name: true,
                isDeleted: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      roles: user.roles
        .filter((assignment) => !assignment.role.isDeleted)
        .map((assignment) => assignment.role.name),
    };
  }

  private mapToResponse(register: RegisterWithRelations): DailyRegisterResponse {
    return {
      id: register.id,
      clientName: register.clientName,
      paymentMethod: register.paymentMethod as PaymentMethod,
      subtotalBase: toMoney(register.subtotalBase.toNumber()),
      discountAmount: toMoney(register.discountAmount.toNumber()),
      cardFeeAmount: toMoney(register.cardFeeAmount.toNumber()),
      totalPaid: toMoney(register.totalPaid.toNumber()),
      totalCommission: toMoney(register.totalCommission.toNumber()),
      mesaUserId: register.mesaUserId,
      mesaUserName: `${register.mesaUser.firstName} ${register.mesaUser.lastName}`.trim(),
      createdById: register.createdById,
      createdByName: `${register.createdBy.firstName} ${register.createdBy.lastName}`.trim(),
      createdAt: register.createdAt,
      updatedAt: register.updatedAt,
      details: register.details.map((detail) => ({
        id: detail.id,
        serviceId: detail.serviceId,
        serviceName: detail.service.name,
        unitPrice: toMoney(detail.unitPrice.toNumber()),
        commissionRate: toMoney(detail.commissionRate.toNumber()),
        quantity: detail.quantity,
        lineSubtotal: toMoney(detail.lineSubtotal.toNumber()),
        lineCommission: toMoney(detail.lineCommission.toNumber()),
      })),
    };
  }
}
