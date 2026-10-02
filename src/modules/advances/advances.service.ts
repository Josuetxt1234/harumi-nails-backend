import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvanceStatus } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  DEFAULT_SALON_TIMEZONE,
  getZonedDayRange,
  getZonedPeriodRange,
  isToday,
} from '../../common/utils/date.util';
import { toMoney } from '../../common/utils/money.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ADVANCES_ERROR_MESSAGES } from './constants/advances-errors.constants';
import { CancelAdvanceDto } from './dto/cancel-advance.dto';
import { CreateAdvanceDto } from './dto/create-advance.dto';
import { QueryAdvancesDto } from './dto/query-advances.dto';
import {
  AdvanceResponse,
  PaginatedAdvances,
} from './interfaces/advance.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { AdvancesRepository } from './advances.repository';

@Injectable()
export class AdvancesService {
  constructor(
    private readonly advancesRepository: AdvancesRepository,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateAdvanceDto,
  ): Promise<AdvanceResponse> {
    const mesaUser = await this.advancesRepository.findActiveMesaUserById(
      dto.mesaUserId,
    );

    if (!mesaUser || !mesaUser.isActive) {
      throw new BadRequestException(
        ADVANCES_ERROR_MESSAGES.MESA_USER_NOT_FOUND,
      );
    }

    const amount = toMoney(dto.amount);
    const reason = dto.reason?.trim() ? dto.reason.trim() : null;
    const date = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const created = await this.advancesRepository.create(tx, {
        mesaUserId: mesaUser.id,
        amount,
        reason,
        date,
        createdById: actor.id,
      });

      await this.notificationsService.notifyVoucherCreated(tx, {
        actorId: actor.id,
        amount: created.amount,
        mesaName: created.mesaUserName,
      });

      return created;
    });
  }

  async findAll(
    actor: AuthenticatedUser,
    query: QueryAdvancesDto,
  ): Promise<PaginatedAdvances> {
    const { start, end } = this.resolveDateRange(query);

    return this.advancesRepository.findMany({
      mesaUserId: this.isMesaOnly(actor) ? actor.id : query.mesaUserId,
      status: query.status,
      start,
      end,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async findMine(
    actor: AuthenticatedUser,
    query: QueryAdvancesDto,
  ): Promise<PaginatedAdvances> {
    const { start, end } = this.resolveDateRange(query);

    return this.advancesRepository.findMany({
      mesaUserId: actor.id,
      status: query.status,
      start,
      end,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async cancel(
    id: string,
    actor: AuthenticatedUser,
    dto: CancelAdvanceDto,
  ): Promise<AdvanceResponse> {
    const reason = dto.reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const advance = await this.advancesRepository.findActiveById(tx, id);

      if (!advance) {
        throw new NotFoundException(ADVANCES_ERROR_MESSAGES.ADVANCE_NOT_FOUND);
      }

      if (
        advance.status === AdvanceStatus.APPLIED ||
        advance.status === AdvanceStatus.CANCELLED
      ) {
        throw new BadRequestException(ADVANCES_ERROR_MESSAGES.CANNOT_CANCEL);
      }

      if (advance.status !== AdvanceStatus.PENDING) {
        throw new BadRequestException(ADVANCES_ERROR_MESSAGES.CANNOT_CANCEL);
      }

      if (this.isAdminWithoutSuperAdmin(actor) && !this.isCreatedToday(advance.createdAt)) {
        throw new ForbiddenException(
          ADVANCES_ERROR_MESSAGES.PREVIOUS_DAY_FORBIDDEN,
        );
      }

      const cancelled = await this.advancesRepository.cancel(tx, id, {
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledByUserId: actor.id,
      });

      await this.notificationsService.notifyVoucherCancelled(tx, {
        actorId: actor.id,
        amount: cancelled.amount,
        mesaName: cancelled.mesaUserName,
        reason,
      });

      return cancelled;
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const advance = await this.advancesRepository.findActiveById(tx, id);

      if (!advance) {
        throw new NotFoundException(ADVANCES_ERROR_MESSAGES.ADVANCE_NOT_FOUND);
      }

      if (advance.status === AdvanceStatus.APPLIED) {
        throw new BadRequestException(
          ADVANCES_ERROR_MESSAGES.CANNOT_DELETE_APPLIED,
        );
      }

      await this.advancesRepository.softDelete(tx, id);
    });
  }

  private resolveDateRange(query: QueryAdvancesDto): {
    start?: Date;
    end?: Date;
  } {
    if (!query.startDate && !query.endDate) {
      return {};
    }

    const timeZone = this.getSalonTimezone();

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
        ADVANCES_ERROR_MESSAGES.INVALID_DATE_RANGE,
      );
    }
  }

  private isCreatedToday(createdAt: Date): boolean {
    return isToday(createdAt, this.getSalonTimezone());
  }

  private isAdminWithoutSuperAdmin(actor: AuthenticatedUser): boolean {
    return (
      actor.roles.includes(SYSTEM_ROLES.ADMIN) &&
      !actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)
    );
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
