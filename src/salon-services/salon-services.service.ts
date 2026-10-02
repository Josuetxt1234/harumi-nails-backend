import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SALON_SERVICES_ERROR_MESSAGES } from './constants/salon-services-errors.constants';
import { CreateServiceDto } from './dto/create-service.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { ToggleServiceStatusDto } from './dto/toggle-service-status.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import {
  PaginatedSalonServices,
  SalonServiceSummary,
} from './interfaces/salon-service.interface';
import { SalonServicesRepository } from './salon-services.repository';

@Injectable()
export class SalonServicesService {
  constructor(
    private readonly salonServicesRepository: SalonServicesRepository,
  ) {}

  async create(
    createServiceDto: CreateServiceDto,
    actorUserId: string,
  ): Promise<SalonServiceSummary> {
    await this.assertNameIsAvailable(createServiceDto.name);

    return this.salonServicesRepository.create({
      name: createServiceDto.name,
      category: createServiceDto.category,
      price: createServiceDto.price,
      commissionPercentage: createServiceDto.commissionPercentage,
      createdById: actorUserId,
    });
  }

  async findAll(query: QueryServicesDto): Promise<PaginatedSalonServices> {
    return this.salonServicesRepository.findAll({
      search: query.search?.trim() || undefined,
      category: query.category || undefined,
      isActive: query.isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async findOne(id: string): Promise<SalonServiceSummary> {
    const service = await this.salonServicesRepository.findById(id);

    if (!service) {
      throw new NotFoundException(SALON_SERVICES_ERROR_MESSAGES.SERVICE_NOT_FOUND);
    }

    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    actorUserId: string,
  ): Promise<SalonServiceSummary> {
    await this.findOne(id);

    if (updateServiceDto.name) {
      await this.assertNameIsAvailable(updateServiceDto.name, id);
    }

    return this.salonServicesRepository.update(id, {
      ...updateServiceDto,
      updatedById: actorUserId,
    });
  }

  async toggleStatus(
    id: string,
    toggleServiceStatusDto: ToggleServiceStatusDto,
    actorUserId: string,
  ): Promise<SalonServiceSummary> {
    await this.findOne(id);

    return this.salonServicesRepository.update(id, {
      isActive: toggleServiceStatusDto.isActive,
      updatedById: actorUserId,
    });
  }

  async remove(id: string, actorUserId: string): Promise<void> {
    await this.findOne(id);
    await this.salonServicesRepository.softDelete(id, actorUserId);
  }

  private async assertNameIsAvailable(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const exists = await this.salonServicesRepository.nameExists(
      name,
      excludeId,
    );

    if (exists) {
      throw new ConflictException(
        SALON_SERVICES_ERROR_MESSAGES.NAME_ALREADY_IN_USE,
      );
    }
  }
}
