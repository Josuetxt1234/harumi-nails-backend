import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';
import { SYSTEM_ROLES } from '../common/constants/roles.constants';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  DEFAULT_SALON_TIMEZONE,
  getZonedDayRange,
  getZonedPeriodRange,
  toCalendarDateString,
} from '../common/utils/date.util';
import { toMoney } from '../common/utils/money.util';
import { SalonServicesRepository } from '../salon-services/salon-services.repository';
import { CARD_FEE_RATE } from './constants/daily-registers.constants';
import { DAILY_REGISTERS_ERROR_MESSAGES } from './constants/daily-registers-errors.constants';
import { CreateDailyRegisterDto } from './dto/create-daily-register.dto';
import { ListDailyRegistersQueryDto } from './dto/list-daily-registers-query.dto';
import {
  CreateDailyRegisterDetailData,
  DailyRegisterResponse,
  PaginatedDailyRegisters,
} from './interfaces/daily-register.interface';
import { DailyRegistersRepository } from './daily-registers.repository';

@Injectable()
export class DailyRegistersService {
  constructor(
    private readonly dailyRegistersRepository: DailyRegistersRepository,
    private readonly salonServicesRepository: SalonServicesRepository,
    private readonly configService: ConfigService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateDailyRegisterDto,
  ): Promise<DailyRegisterResponse> {
    const mesaUserId = await this.resolveMesaUserId(actor, dto.mesaUserId);
    const uniqueServiceIds = [...new Set(dto.items.map((item) => item.serviceId))];
    const services =
      await this.salonServicesRepository.findActiveByIds(uniqueServiceIds);

    if (services.length !== uniqueServiceIds.length) {
      throw new BadRequestException(
        DAILY_REGISTERS_ERROR_MESSAGES.INVALID_SERVICES,
      );
    }

    const serviceById = new Map(services.map((service) => [service.id, service]));
    const details: CreateDailyRegisterDetailData[] = dto.items.map((item) => {
      const service = serviceById.get(item.serviceId)!;
      const unitPrice = toMoney(service.price.toNumber());
      const commissionRate = toMoney(service.commissionPercentage.toNumber());
      const lineSubtotal = toMoney(unitPrice * item.quantity);
      const lineCommission = toMoney(
        unitPrice * item.quantity * (commissionRate / 100),
      );

      return {
        serviceId: service.id,
        unitPrice,
        commissionRate,
        quantity: item.quantity,
        lineSubtotal,
        lineCommission,
      };
    });

    const subtotalBase = toMoney(
      details.reduce((sum, detail) => sum + detail.lineSubtotal, 0),
    );
    const discountAmount = toMoney(dto.discountAmount ?? 0);

    if (discountAmount > subtotalBase) {
      throw new BadRequestException(
        DAILY_REGISTERS_ERROR_MESSAGES.DISCOUNT_EXCEEDS_SUBTOTAL,
      );
    }

    const amountAfterDiscount = toMoney(subtotalBase - discountAmount);
    const shouldApplyCardFee =
      dto.paymentMethod === PaymentMethod.CARD && dto.hasCardFee === true;
    const cardFeeAmount = shouldApplyCardFee
      ? toMoney(amountAfterDiscount * CARD_FEE_RATE)
      : 0;
    const totalPaid = toMoney(amountAfterDiscount + cardFeeAmount);
    const totalCommission = toMoney(
      details.reduce((sum, detail) => sum + detail.lineCommission, 0),
    );

    return this.dailyRegistersRepository.create({
      clientName: dto.clientName.trim(),
      paymentMethod: dto.paymentMethod,
      subtotalBase,
      discountAmount,
      cardFeeAmount,
      totalPaid,
      totalCommission,
      mesaUserId,
      createdById: actor.id,
      details,
    });
  }

  async listTodayForActor(
    actor: AuthenticatedUser,
  ): Promise<DailyRegisterResponse[]> {
    const { startOfDay, endOfDay } = getZonedDayRange(this.getSalonTimezone());

    if (this.isElevated(actor)) {
      return this.dailyRegistersRepository.findToday({
        startOfDay,
        endOfDay,
      });
    }

    return this.dailyRegistersRepository.findToday({
      startOfDay,
      endOfDay,
      mesaUserId: actor.id,
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListDailyRegistersQueryDto,
  ): Promise<PaginatedDailyRegisters> {
    const isElevated = this.isElevated(actor);
    const { start, end } = this.resolvePeriodRange(query);

    return this.dailyRegistersRepository.findMany({
      start,
      end,
      mesaUserId: isElevated ? query.mesaUserId : actor.id,
      paymentMethod: query.paymentMethod,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  async getById(
    registerId: string,
    actor: AuthenticatedUser,
  ): Promise<DailyRegisterResponse> {
    const register = await this.findActiveRegisterOrFail(registerId);

    this.assertCanAccessRegister(register, actor);

    return register;
  }

  async voidRegister(
    registerId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const register = await this.findActiveRegisterOrFail(registerId);

    this.assertCanAccessRegister(register, actor);

    await this.dailyRegistersRepository.softDelete(registerId, actor.id);
  }

  async listActiveMesaUsers(): Promise<
    Array<{ id: string; firstName: string; lastName: string }>
  > {
    return this.dailyRegistersRepository.findActiveMesaUsers();
  }

  private resolvePeriodRange(query: ListDailyRegistersQueryDto): {
    start: Date;
    end: Date;
  } {
    try {
      const startDate = toCalendarDateString(query.startDate);
      const endDate = toCalendarDateString(query.endDate);
      const hasCustomDates = Boolean(startDate && endDate);
      const dateRange =
        query.dateRange === 'CUSTOM' || hasCustomDates
          ? 'CUSTOM'
          : (query.dateRange ?? 'TODAY');

      return getZonedPeriodRange(
        dateRange,
        this.getSalonTimezone(),
        startDate,
        endDate,
      );
    } catch {
      throw new BadRequestException(
        DAILY_REGISTERS_ERROR_MESSAGES.INVALID_DATE_RANGE,
      );
    }
  }

  private async findActiveRegisterOrFail(
    registerId: string,
  ): Promise<DailyRegisterResponse> {
    const register =
      await this.dailyRegistersRepository.findActiveById(registerId);

    if (!register) {
      throw new NotFoundException(
        DAILY_REGISTERS_ERROR_MESSAGES.REGISTER_NOT_FOUND,
      );
    }

    return register;
  }

  /**
   * A non-elevated actor may only reach the registers booked under their own
   * mesa id, so guessing another register's uuid leads nowhere.
   */
  private assertCanAccessRegister(
    register: DailyRegisterResponse,
    actor: AuthenticatedUser,
  ): void {
    if (this.isElevated(actor) || register.mesaUserId === actor.id) {
      return;
    }

    throw new ForbiddenException(
      DAILY_REGISTERS_ERROR_MESSAGES.REGISTER_FORBIDDEN,
    );
  }

  private getSalonTimezone(): string {
    return (
      this.configService.get<string>('salonTimezone') ?? DEFAULT_SALON_TIMEZONE
    );
  }

  private isElevated(actor: AuthenticatedUser): boolean {
    return (
      actor.roles.includes(SYSTEM_ROLES.ADMIN) ||
      actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)
    );
  }

  private async resolveMesaUserId(
    actor: AuthenticatedUser,
    requestedMesaUserId?: string,
  ): Promise<string> {
    const isElevated = this.isElevated(actor);
    const isMesaOnly =
      actor.roles.includes(SYSTEM_ROLES.MESA) && !isElevated;

    if (isMesaOnly) {
      return actor.id;
    }

    if (!isElevated) {
      throw new BadRequestException(
        DAILY_REGISTERS_ERROR_MESSAGES.MESA_USER_REQUIRED,
      );
    }

    if (!requestedMesaUserId) {
      throw new BadRequestException(
        DAILY_REGISTERS_ERROR_MESSAGES.MESA_USER_REQUIRED,
      );
    }

    const mesaUser =
      await this.dailyRegistersRepository.findActiveMesaUserById(
        requestedMesaUserId,
      );

    if (!mesaUser || !mesaUser.roles.includes(SYSTEM_ROLES.MESA)) {
      throw new BadRequestException(
        DAILY_REGISTERS_ERROR_MESSAGES.MESA_USER_INVALID,
      );
    }

    return mesaUser.id;
  }
}
