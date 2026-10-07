import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';
import { SYSTEM_ROLES } from '../common/constants/roles.constants';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { SalonServicesRepository } from '../salon-services/salon-services.repository';
import { DailyRegistersRepository } from './daily-registers.repository';
import { DailyRegistersService } from './daily-registers.service';
import { DailyRegisterResponse } from './interfaces/daily-register.interface';

const OWNER_ID = 'c0ffee00-0000-4000-8000-000000000001';
const INTRUDER_ID = 'c0ffee00-0000-4000-8000-000000000002';
const REGISTER_ID = 'c0ffee00-0000-4000-8000-0000000000ff';

function buildRegister(): DailyRegisterResponse {
  return {
    id: REGISTER_ID,
    clientName: 'Cliente',
    paymentMethod: PaymentMethod.CASH,
    subtotalBase: 20,
    discountAmount: 0,
    cardFeeAmount: 0,
    totalPaid: 20,
    totalCommission: 10,
    mesaUserId: OWNER_ID,
    createdById: OWNER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    details: [],
  };
}

function buildActor(id: string, roles: string[]): AuthenticatedUser {
  return {
    id,
    email: `${id}@haruminails.com`,
    roles,
    permissions: [],
    mustChangePassword: false,
  };
}

describe('DailyRegistersService access control', () => {
  let service: DailyRegistersService;
  let repository: { findActiveById: jest.Mock; softDelete: jest.Mock };

  beforeEach(() => {
    repository = {
      findActiveById: jest.fn().mockResolvedValue(buildRegister()),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    service = new DailyRegistersService(
      repository as unknown as DailyRegistersRepository,
      {} as SalonServicesRepository,
      { get: () => 'America/Guayaquil' } as unknown as ConfigService,
    );
  });

  it('returns the register to its owner', async () => {
    const actor = buildActor(OWNER_ID, [SYSTEM_ROLES.MESA]);

    await expect(service.getById(REGISTER_ID, actor)).resolves.toMatchObject({
      id: REGISTER_ID,
    });
  });

  it.each([SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN])(
    'returns any register to %s',
    async (role) => {
      const actor = buildActor(INTRUDER_ID, [role]);

      await expect(service.getById(REGISTER_ID, actor)).resolves.toMatchObject({
        id: REGISTER_ID,
      });
    },
  );

  it('rejects a mesa user reading someone else register', async () => {
    const actor = buildActor(INTRUDER_ID, [SYSTEM_ROLES.MESA]);

    await expect(service.getById(REGISTER_ID, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a mesa user voiding someone else register', async () => {
    const actor = buildActor(INTRUDER_ID, [SYSTEM_ROLES.MESA]);

    await expect(
      service.voidRegister(REGISTER_ID, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('reports a missing register as not found', async () => {
    repository.findActiveById.mockResolvedValue(null);
    const actor = buildActor(OWNER_ID, [SYSTEM_ROLES.SUPER_ADMIN]);

    await expect(service.getById(REGISTER_ID, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
