import { Injectable } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toMoney } from '../common/utils/money.util';
import {
  CreateDailyRegisterData,
  DailyRegisterResponse,
  ListDailyRegistersFilters,
  PaginatedDailyRegisters,
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
          subtotalBase: data.subtotalBase,
          discountAmount: data.discountAmount,
          cardFeeAmount: data.cardFeeAmount,
          totalPaid: data.totalPaid,
          totalCommission: data.totalCommission,
          mesaUserId: data.mesaUserId,
          createdById: data.createdById,
          details: {
            create: data.details.map((detail) => ({
              serviceId: detail.serviceId,
              unitPrice: detail.unitPrice,
              commissionRate: detail.commissionRate,
              quantity: detail.quantity,
              lineSubtotal: detail.lineSubtotal,
              lineCommission: detail.lineCommission,
            })),
          },
        },
        include: registerInclude,
      });
    });

    return this.mapToResponse(created);
  }

  async findTodayByMesaUserId(
    mesaUserId: string,
  ): Promise<DailyRegisterResponse[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const registers = await this.prisma.dailyRegister.findMany({
      where: {
        mesaUserId,
        isDeleted: false,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: registerInclude,
      orderBy: { createdAt: 'desc' },
    });

    return registers.map((register) => this.mapToResponse(register));
  }

  async findMany(
    filters: ListDailyRegistersFilters,
  ): Promise<PaginatedDailyRegisters> {
    const { startOfDay, endOfDay } = this.resolveDateRange(filters.date);

    const where: Prisma.DailyRegisterWhereInput = {
      isDeleted: false,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      ...(filters.mesaUserId ? { mesaUserId: filters.mesaUserId } : {}),
      ...(filters.paymentMethod
        ? { paymentMethod: filters.paymentMethod }
        : {}),
    };

    const [total, registers] = await this.prisma.$transaction([
      this.prisma.dailyRegister.count({ where }),
      this.prisma.dailyRegister.findMany({
        where,
        include: registerInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: registers.map((register) => this.mapToResponse(register)),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
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

  private resolveDateRange(date?: string): {
    startOfDay: Date;
    endOfDay: Date;
  } {
    const targetDate = date ? new Date(`${date}T00:00:00`) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
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
      subtotalBase: toMoney(Number(register.subtotalBase)),
      discountAmount: toMoney(Number(register.discountAmount)),
      cardFeeAmount: toMoney(Number(register.cardFeeAmount)),
      totalPaid: toMoney(Number(register.totalPaid)),
      totalCommission: toMoney(Number(register.totalCommission)),
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
        unitPrice: toMoney(Number(detail.unitPrice)),
        commissionRate: toMoney(Number(detail.commissionRate)),
        quantity: detail.quantity,
        lineSubtotal: toMoney(Number(detail.lineSubtotal)),
        lineCommission: toMoney(Number(detail.lineCommission)),
      })),
    };
  }
}
