import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYROLL_ERROR_MESSAGES } from './constants/payroll.constants';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { QueryPayrollDto } from './dto/query-payroll.dto';
import {
  PaginatedPayrolls,
  PayrollDetail,
  PayrollPreview,
  PayrollResponse,
} from './interfaces/payroll.interface';
import { calculatePayrollTotals } from './payroll-calculator';
import { PayrollRepository } from './payroll.repository';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async calculatePreview(
    dto: GeneratePayrollDto,
  ): Promise<PayrollPreview> {
    const mesaUser = await this.requireActiveMesaUser(dto.mesaUserId);
    const { start, end } = this.resolvePeriod(dto);
    const timeZone = this.getSalonTimezone();

    const existing = await this.payrollRepository.findExistingForPeriod(
      this.prisma,
      mesaUser.id,
      start,
      end,
    );
    const draftId =
      existing?.status === PayrollStatus.DRAFT ? existing.id : null;

    const [registers, advances] = await Promise.all([
      this.payrollRepository.findUnlinkedRegisters(
        this.prisma,
        mesaUser.id,
        start,
        end,
        draftId,
      ),
      this.payrollRepository.findPendingAdvances(
        this.prisma,
        mesaUser.id,
        end,
        draftId,
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
    actor: AuthenticatedUser,
  ): Promise<PayrollResponse> {
    const mesaUser = await this.requireActiveMesaUser(dto.mesaUserId);
    const { start, end } = this.resolvePeriod(dto);
    const timeZone = this.getSalonTimezone();
    const mesaUserName = `${mesaUser.firstName} ${mesaUser.lastName}`.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await this.payrollRepository.findExistingForPeriod(
        tx,
        mesaUser.id,
        start,
        end,
      );

      if (existing && existing.status !== PayrollStatus.DRAFT) {
        throw new ConflictException(
          PAYROLL_ERROR_MESSAGES.PERIOD_ALREADY_CLOSED,
        );
      }

      if (existing) {
        await this.payrollRepository.releaseDraftLinks(tx, existing.id);
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
      const payroll = existing
        ? await this.payrollRepository.updateDraft(tx, existing.id, totals)
        : await this.payrollRepository.create(tx, {
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

      return { payroll, created: !existing };
    });

    await this.notifyPayrollSafe(
      result.created ? 'generated' : 'updated',
      result.payroll,
      actor.id,
      mesaUserName,
    );

    return result.payroll;
  }

  async closePayroll(
    payrollId: string,
    actor: AuthenticatedUser,
  ): Promise<PayrollResponse> {
    const payroll = await this.prisma.$transaction(async (tx) => {
      const current = await this.payrollRepository.findActiveById(
        tx,
        payrollId,
      );

      if (!current) {
        throw new NotFoundException(PAYROLL_ERROR_MESSAGES.PAYROLL_NOT_FOUND);
      }

      if (current.status !== PayrollStatus.DRAFT) {
        throw new BadRequestException(
          PAYROLL_ERROR_MESSAGES.CANNOT_CLOSE_NON_DRAFT,
        );
      }

      return this.payrollRepository.close(tx, payrollId, actor.id);
    });

    await this.notifyPayrollSafe(
      'closed',
      payroll,
      actor.id,
      payroll.mesaUserName,
    );

    return payroll;
  }

  private async notifyPayrollSafe(
    kind: 'generated' | 'updated' | 'closed',
    payroll: PayrollResponse,
    actorId: string,
    mesaName: string,
  ): Promise<void> {
    try {
      const payload = {
        actorId,
        mesaUserId: payroll.mesaUserId,
        mesaName,
        netPayable: payroll.netPayable,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
      };

      if (kind === 'generated') {
        await this.notificationsService.notifyPayrollGenerated(payload);
        return;
      }

      if (kind === 'updated') {
        await this.notificationsService.notifyPayrollDraftUpdated(
          payroll.mesaUserId,
        );
        return;
      }

      await this.notificationsService.notifyPayrollClosed(payload);
    } catch (error) {
      this.logger.warn(
        `Payroll ${kind} notification failed for ${payroll.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
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
    return this.payrollRepository.findRecentForMesa(actor.id, query.status);
  }

  async findMineById(
    actor: AuthenticatedUser,
    payrollId: string,
  ): Promise<PayrollDetail> {
    const detail = await this.payrollRepository.findDetailById(payrollId);

    if (!detail || detail.mesaUserId !== actor.id) {
      throw new NotFoundException(PAYROLL_ERROR_MESSAGES.PAYROLL_NOT_FOUND);
    }

    return detail;
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
