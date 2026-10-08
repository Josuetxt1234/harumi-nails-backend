import { Injectable } from '@nestjs/common';
import { AdvanceStatus, PayrollStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toMoney } from '../../common/utils/money.util';
import { MESA_CLOSED_PAYROLL_HISTORY_LIMIT } from './constants/payroll.constants';
import {
  CreatePayrollData,
  ListPayrollFilters,
  PaginatedPayrolls,
  PayrollAdvanceLine,
  PayrollDetail,
  PayrollRegisterLine,
  PayrollResponse,
  PayrollTotals,
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
  ): Promise<{ id: string; status: PayrollStatus } | null> {
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
      select: { id: true, status: true },
    });
  }

  async findUnlinkedRegisters(
    client: PrismaClientLike,
    mesaUserId: string,
    periodStart: Date,
    periodEnd: Date,
    alsoLinkedToPayrollId: string | null = null,
  ): Promise<PayrollRegisterInput[]> {
    return client.dailyRegister.findMany({
      where: {
        mesaUserId,
        isDeleted: false,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        OR: [
          { payrollId: null },
          ...(alsoLinkedToPayrollId
            ? [{ payrollId: alsoLinkedToPayrollId }]
            : []),
        ],
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
    alsoLinkedToPayrollId: string | null = null,
  ): Promise<PayrollAdvanceInput[]> {
    return client.advance.findMany({
      where: {
        mesaUserId,
        isDeleted: false,
        OR: [
          {
            status: AdvanceStatus.PENDING,
            date: { lte: periodEnd },
          },
          ...(alsoLinkedToPayrollId
            ? [
                {
                  payrollId: alsoLinkedToPayrollId,
                  status: AdvanceStatus.APPLIED,
                },
              ]
            : []),
        ],
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

  async releaseDraftLinks(
    client: PrismaClientLike,
    payrollId: string,
  ): Promise<void> {
    await client.dailyRegister.updateMany({
      where: { payrollId },
      data: { payrollId: null },
    });
    await client.advance.updateMany({
      where: {
        payrollId,
        status: AdvanceStatus.APPLIED,
        isDeleted: false,
      },
      data: {
        status: AdvanceStatus.PENDING,
        payrollId: null,
      },
    });
  }

  async updateDraft(
    client: PrismaClientLike,
    id: string,
    totals: PayrollTotals,
  ): Promise<PayrollResponse> {
    const updated = await client.payroll.update({
      where: { id },
      data: {
        grossSales: new Prisma.Decimal(totals.grossSales.toFixed(2)),
        baseCommissionTotal: new Prisma.Decimal(
          totals.baseCommissionTotal.toFixed(2),
        ),
        weekendBonusTotal: new Prisma.Decimal(
          totals.weekendBonusTotal.toFixed(2),
        ),
        advancesDeductionTotal: new Prisma.Decimal(
          totals.advancesDeductionTotal.toFixed(2),
        ),
        netPayable: new Prisma.Decimal(totals.netPayable.toFixed(2)),
        status: PayrollStatus.DRAFT,
      },
      include: payrollInclude,
    });

    return this.mapToResponse(updated);
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

  async findRecentForMesa(
    mesaUserId: string,
    status?: PayrollStatus,
  ): Promise<PaginatedPayrolls> {
    const closedStatuses: PayrollStatus[] = [
      PayrollStatus.CLOSED,
      PayrollStatus.PAID,
    ];
    const includeDrafts = !status || status === PayrollStatus.DRAFT;
    const includeClosed =
      !status || closedStatuses.includes(status);

    const [drafts, closed] = await Promise.all([
      includeDrafts
        ? this.prisma.payroll.findMany({
            where: {
              mesaUserId,
              isDeleted: false,
              status: PayrollStatus.DRAFT,
            },
            include: payrollInclude,
            orderBy: { periodStart: 'desc' },
          })
        : Promise.resolve([]),
      includeClosed
        ? this.prisma.payroll.findMany({
            where: {
              mesaUserId,
              isDeleted: false,
              status: status && status !== PayrollStatus.DRAFT
                ? status
                : { in: closedStatuses },
            },
            include: payrollInclude,
            orderBy: { periodStart: 'desc' },
            take: MESA_CLOSED_PAYROLL_HISTORY_LIMIT,
          })
        : Promise.resolve([]),
    ]);

    const data = [...drafts, ...closed].map((payroll) =>
      this.mapToResponse(payroll),
    );

    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        limit: MESA_CLOSED_PAYROLL_HISTORY_LIMIT,
        totalPages: 1,
      },
    };
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

  async findDetailById(id: string): Promise<PayrollDetail | null> {
    const payroll = await this.prisma.payroll.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        ...payrollInclude,
        dailyRegisters: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            clientName: true,
            createdAt: true,
            totalPaid: true,
            totalCommission: true,
            details: {
              select: {
                quantity: true,
                lineSubtotal: true,
                lineCommission: true,
                service: { select: { name: true } },
              },
            },
          },
        },
        advances: {
          where: { isDeleted: false },
          orderBy: { date: 'asc' },
          select: {
            id: true,
            amount: true,
            reason: true,
            date: true,
            status: true,
          },
        },
      },
    });

    if (!payroll) {
      return null;
    }

    const registers: PayrollRegisterLine[] = payroll.dailyRegisters.map(
      (register) => ({
        id: register.id,
        clientName: register.clientName,
        createdAt: register.createdAt,
        totalPaid: toMoney(register.totalPaid.toNumber()),
        totalCommission: toMoney(register.totalCommission.toNumber()),
        services: register.details.map((detail) => ({
          serviceName: detail.service.name,
          quantity: detail.quantity,
          lineSubtotal: toMoney(detail.lineSubtotal.toNumber()),
          lineCommission: toMoney(detail.lineCommission.toNumber()),
        })),
      }),
    );
    const advances: PayrollAdvanceLine[] = payroll.advances.map((advance) => ({
      id: advance.id,
      amount: toMoney(advance.amount.toNumber()),
      reason: advance.reason,
      date: advance.date,
      status: advance.status,
    }));

    return {
      ...this.mapToResponse(payroll),
      registers,
      advances,
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
