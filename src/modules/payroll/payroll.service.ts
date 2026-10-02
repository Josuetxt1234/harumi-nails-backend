import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayrollStatus } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  DEFAULT_SALON_TIMEZONE,
  getSalonPayrollWeekRange,
} from '../../common/utils/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYROLL_ERROR_MESSAGES } from './constants/payroll.constants';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { QueryPayrollDto } from './dto/query-payroll.dto';
import {
  PaginatedPayrolls,
  PayrollPreview,
  PayrollResponse,
} from './interfaces/payroll.interface';
import { calculatePayrollTotals } from './payroll-calculator';
import { PayrollRepository } from './payroll.repository';

@Injectable()
export class PayrollService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async calculatePreview(
    dto: GeneratePayrollDto,
  ): Promise<PayrollPreview> {
    const mesaUser = await this.requireActiveMesaUser(dto.mesaUserId);
    const { start, end } = this.resolvePeriod(dto);
    const timeZone = this.getSalonTimezone();

    const [registers, advances] = await Promise.all([
      this.payrollRepository.findUnlinkedRegisters(
        this.prisma,
        mesaUser.id,
        start,
        end,
      ),
      this.payrollRepository.findPendingAdvances(
        this.prisma,
        mesaUser.id,
        end,
      ),
    ]);

    const totals = calculatePayrollTotals(registers, advances, timeZone);

    return {
      mesaUserId: mesaUser.id,
      mesaUserName: `${mesaUser.firstName} ${mesaUser.lastName}`.trim(),
      periodStart: start,
      periodEnd: end,
      ...totals,
      registersCount: totals.registerIds.length,
      advancesCount: totals.advanceIds.length,
    };
  }

  async generate(
    dto: GeneratePayrollDto,
  ): Promise<PayrollResponse> {
    const mesaUser = await this.requireActiveMesaUser(dto.mesaUserId);
    const { start, end } = this.resolvePeriod(dto);
    const timeZone = this.getSalonTimezone();

    return this.prisma.$transaction(async (tx) => {
      const existingClosed =
        await this.payrollRepository.findExistingForPeriod(
          tx,
          mesaUser.id,
          start,
          end,
        );

      if (existingClosed) {
        throw new ConflictException(
          PAYROLL_ERROR_MESSAGES.PERIOD_ALREADY_CLOSED,
        );
      }

      const registers = await this.payrollRepository.findUnlinkedRegisters(
        tx,
        mesaUser.id,
        start,
        end,
      );
      const advances = await this.payrollRepository.findPendingAdvances(
        tx,
        mesaUser.id,
        end,
      );
      const totals = calculatePayrollTotals(registers, advances, timeZone);

      const payroll = await this.payrollRepository.create(tx, {
        mesaUserId: mesaUser.id,
        periodStart: start,
        periodEnd: end,
        grossSales: totals.grossSales,
        baseCommissionTotal: totals.baseCommissionTotal,
        weekendBonusTotal: totals.weekendBonusTotal,
        advancesDeductionTotal: totals.advancesDeductionTotal,
        netPayable: totals.netPayable,
      });

      await this.payrollRepository.linkRegistersAndAdvances(
        tx,
        payroll.id,
        totals.registerIds,
        totals.advanceIds,
      );

      return payroll;
    });
  }

  async closePayroll(
    payrollId: string,
    actor: AuthenticatedUser,
  ): Promise<PayrollResponse> {
    return this.prisma.$transaction(async (tx) => {
      const payroll = await this.payrollRepository.findActiveById(
        tx,
        payrollId,
      );

      if (!payroll) {
        throw new NotFoundException(PAYROLL_ERROR_MESSAGES.PAYROLL_NOT_FOUND);
      }

      if (payroll.status !== PayrollStatus.DRAFT) {
        throw new BadRequestException(
          PAYROLL_ERROR_MESSAGES.CANNOT_CLOSE_NON_DRAFT,
        );
      }

      return this.payrollRepository.close(tx, payrollId, actor.id);
    });
  }

  async findAll(
    actor: AuthenticatedUser,
    query: QueryPayrollDto,
  ): Promise<PaginatedPayrolls> {
    return this.payrollRepository.findMany({
      mesaUserId: this.isMesaOnly(actor) ? actor.id : query.mesaUserId,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async findMine(
    actor: AuthenticatedUser,
    query: QueryPayrollDto,
  ): Promise<PaginatedPayrolls> {
    return this.payrollRepository.findMany({
      mesaUserId: actor.id,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  private async requireActiveMesaUser(mesaUserId: string): Promise<{
    id: string;
    firstName: string;
    lastName: string;
  }> {
    const mesaUser =
      await this.payrollRepository.findActiveMesaUserById(mesaUserId);

    if (!mesaUser || !mesaUser.isActive) {
      throw new BadRequestException(PAYROLL_ERROR_MESSAGES.MESA_USER_NOT_FOUND);
    }

    return mesaUser;
  }

  private resolvePeriod(dto: GeneratePayrollDto): { start: Date; end: Date } {
    try {
      return getSalonPayrollWeekRange(
        this.getSalonTimezone(),
        dto.periodStart,
        dto.periodEnd,
      );
    } catch {
      throw new BadRequestException(PAYROLL_ERROR_MESSAGES.INVALID_PERIOD);
    }
  }

  private isMesaOnly(actor: AuthenticatedUser): boolean {
    return (
      actor.roles.includes(SYSTEM_ROLES.MESA) &&
      !actor.roles.includes(SYSTEM_ROLES.ADMIN) &&
      !actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)
    );
  }

  private getSalonTimezone(): string {
    return (
      this.configService.get<string>('salonTimezone') ?? DEFAULT_SALON_TIMEZONE
    );
  }
}
