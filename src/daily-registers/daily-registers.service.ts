import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SYSTEM_ROLES } from '../common/constants/roles.constants';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
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
        'One or more services are invalid, inactive, or deleted.',
      );
    }

    const serviceById = new Map(services.map((service) => [service.id, service]));
    const details: CreateDailyRegisterDetailData[] = dto.items.map((item) => {
      const service = serviceById.get(item.serviceId)!;
      const unitPrice = toMoney(Number(service.price));
      const commissionRate = toMoney(Number(service.commissionPercentage));
      const lineSubtotal = toMoney(unitPrice * item.quantity);
      const lineCommission = toMoney(lineSubtotal * (commissionRate / 100));

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
        'discountAmount cannot be greater than the subtotal.',
      );
    }

    const amountAfterDiscount = toMoney(subtotalBase - discountAmount);
    const cardFeeAmount = dto.hasCardFee
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
    return this.dailyRegistersRepository.findTodayByMesaUserId(actor.id);
  }

  async list(
    actor: AuthenticatedUser,
    query: ListDailyRegistersQueryDto,
  ): Promise<PaginatedDailyRegisters> {
    const isElevated = this.isElevated(actor);

    if (!isElevated) {
      return this.dailyRegistersRepository.findMany({
        date: query.date,
        mesaUserId: actor.id,
        paymentMethod: query.paymentMethod,
        page: query.page ?? 1,
        limit: query.limit ?? 50,
      });
    }

    return this.dailyRegistersRepository.findMany({
      date: query.date,
      mesaUserId: query.mesaUserId,
      paymentMethod: query.paymentMethod,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  async getById(
    registerId: string,
  ): Promise<DailyRegisterResponse> {
    const register = await this.dailyRegistersRepository.findActiveById(registerId);

    if (!register) {
      throw new NotFoundException(DAILY_REGISTERS_ERROR_MESSAGES.REGISTER_NOT_FOUND);
    }

    return register;
  }

  async voidRegister(
    registerId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const register = await this.dailyRegistersRepository.findActiveById(registerId);

    if (!register) {
      throw new NotFoundException(DAILY_REGISTERS_ERROR_MESSAGES.REGISTER_NOT_FOUND);
    }

    await this.dailyRegistersRepository.softDelete(registerId, actor.id);
  }

  async listActiveMesaUsers(): Promise<
    Array<{ id: string; firstName: string; lastName: string }>
  > {
    return this.dailyRegistersRepository.findActiveMesaUsers();
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

    if (!requestedMesaUserId) {
      throw new BadRequestException(
        'mesaUserId is required for admin users.',
      );
    }

    const mesaUser =
      await this.dailyRegistersRepository.findActiveMesaUserById(
        requestedMesaUserId,
      );

    if (!mesaUser || !mesaUser.roles.includes(SYSTEM_ROLES.MESA)) {
      throw new BadRequestException(
        'mesaUserId must reference an active user with MESA role.',
      );
    }

    return mesaUser.id;
  }
}
