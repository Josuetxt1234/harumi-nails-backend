import { Injectable, NotFoundException } from '@nestjs/common';
import { SalonServiceSummary } from './interfaces/salon-service.interface';
import { SalonServicesRepository } from './salon-services.repository';

@Injectable()
export class SalonServicesService {
  constructor(
    private readonly salonServicesRepository: SalonServicesRepository,
  ) {}

  async listActive(category?: string): Promise<SalonServiceSummary[]> {
    return this.salonServicesRepository.findActive(category);
  }

  async getActiveById(id: string): Promise<SalonServiceSummary> {
    const service = await this.salonServicesRepository.findActiveById(id);

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    return service;
  }
}
