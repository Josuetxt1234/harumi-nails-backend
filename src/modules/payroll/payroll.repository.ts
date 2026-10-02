import { Injectable } from '@nestjs/common';
import { AdvanceStatus, PayrollStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toMoney } from '../../common/utils/money.util';
import {
  CreatePayrollData,
  ListPayrollFilters,
  PaginatedPayrolls,
  PayrollResponse,
} from './interfaces/payroll.interface';
import {
  PayrollAdvanceInput,
  PayrollRegisterInput,
} from './payroll-calculator';

const payrollInclude = {
  mesaUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.PayrollInclude;

type PayrollWithMesa = Prisma.PayrollGetPayload<{
  include: typeof payrollInclude;
}>;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveMesaUserById(userId: string): Promise<{
    id: string;
    isActive: boolean;
    firstName: string;
    lastName: string;
  } | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
      select: {
        id: true,
        isActive: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async findExistingForPeriod(
    client: PrismaClientLike,
    mesaUserId: string,
    periodStart: Date,
    _periodEnd: Date,
  ): Promise<{ id: string } | null> {
    return client.payroll.findFirst({
      where: {
        mesaUserId,
        periodStart,
        isDeleted: false,
        status: {
          in: [
            PayrollStatus.DRAFT,
            PayrollStatus.CLOSED,
            PayrollStatus.PAID,
          ],
        },
      },
      select: { id: true },
    });
  }

  async findUnlinkedRegisters(
    client: PrismaClientLike,
    mesaUserId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayrollRegisterInput[]> {
    return client.dailyRegister.findMany({
      where: {
        mesaUserId,
        isDeleted: false,
        payrollId: null,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: {
        id: true,
        createdAt: true,
        totalPaid: true,
        details: {
          select: {
            lineSubtotal: true,
            lineCommission: true,
          },
        },
      },
    });
  }

  async findPendingAdvances(
    client: PrismaClientLike,
    mesaUserId: string,
    periodEnd: Date,
  ): Promise<PayrollAdvanceInput[]> {
    return client.advance.findMany({
      where: {
        mesaUserId,
        isDeleted: false,
        status: AdvanceStatus.PENDING,
        date: {
          lte: periodEnd,
        },
      },
      select: {
        id: true,
        amount: true,
      },
    });
  }

  async create(
    client: PrismaClientLike,
    data: CreatePayrollData,
  ): Promise<PayrollResponse> {
    const created = await client.payroll.create({
      data: {
        mesaUserId: data.mesaUserId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        grossSales: new Prisma.Decimal(data.grossSales.toFixed(2)),
        baseCommissionTotal: new Prisma.Decimal(
          data.baseCommissionTotal.toFixed(2),
        ),
        weekendBonusTotal: new Prisma.Decimal(
          data.weekendBonusTotal.toFixed(2),
        ),
        advancesDeductionTotal: new Prisma.Decimal(
          data.advancesDeductionTotal.toFixed(2),
        ),
        netPayable: new Prisma.Decimal(data.netPayable.toFixed(2)),
        status: PayrollStatus.DRAFT,
      },
      include: payrollInclude,
    });

    return this.mapToResponse(created);
  }

  async linkRegistersAndAdvances(
    client: PrismaClientLike,
    payrollId: string,
    registerIds: string[],
    advanceIds: string[],
  ): Promise<void> {
    if (registerIds.length > 0) {
      await client.dailyRegister.updateMany({
        where: {
          id: { in: registerIds },
          payrollId: null,
          isDeleted: false,
        },
        data: {
          payrollId,
        },
      });
    }

    if (advanceIds.length > 0) {
      await client.advance.updateMany({
        where: {
          id: { in: advanceIds },
          status: AdvanceStatus.PENDING,
          isDeleted: false,
        },
        data: {
          status: AdvanceStatus.APPLIED,
          payrollId,
        },
      });
    }
  }

  async findActiveById(
    client: PrismaClientLike,
    id: string,
  ): Promise<PayrollResponse | null> {
    const payroll = await client.payroll.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: payrollInclude,
    });

    return payroll ? this.mapToResponse(payroll) : null;
  }

  async close(
    client: PrismaClientLike,
    id: string,
    closedById: string,
  ): Promise<PayrollResponse> {
    const updated = await client.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.CLOSED,
        closedAt: new Date(),
        closedById,
      },
      include: payrollInclude,
    });

    return this.mapToResponse(updated);
  }

  async findMany(filters: ListPayrollFilters): Promise<PaginatedPayrolls> {
    const where: Prisma.PayrollWhereInput = {
      isDeleted: false,
      ...(filters.mesaUserId ? { mesaUserId: filters.mesaUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [total, payrolls] = await this.prisma.$transaction([
      this.prisma.payroll.count({ where }),
      this.prisma.payroll.findMany({
        where,
        include: payrollInclude,
        orderBy: { periodStart: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: payrolls.map((payroll: PayrollWithMesa) =>
        this.mapToResponse(payroll),
      ),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }

  private mapToResponse(payroll: PayrollWithMesa): PayrollResponse {
    return {
      id: payroll.id,
      mesaUserId: payroll.mesaUserId,
      mesaUserName:
        `${payroll.mesaUser.firstName} ${payroll.mesaUser.lastName}`.trim(),
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      grossSales: toMoney(payroll.grossSales.toNumber()),
      baseCommissionTotal: toMoney(payroll.baseCommissionTotal.toNumber()),
      weekendBonusTotal: toMoney(payroll.weekendBonusTotal.toNumber()),
      advancesDeductionTotal: toMoney(
        payroll.advancesDeductionTotal.toNumber(),
      ),
      netPayable: toMoney(payroll.netPayable.toNumber()),
      status: payroll.status,
      closedAt: payroll.closedAt,
      closedById: payroll.closedById,
      createdAt: payroll.createdAt,
      updatedAt: payroll.updatedAt,
    };
  }
}
