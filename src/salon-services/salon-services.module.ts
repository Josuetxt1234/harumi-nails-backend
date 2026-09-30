import { Module } from '@nestjs/common';
import { SalonServicesController } from './salon-services.controller';
import { SalonServicesRepository } from './salon-services.repository';
import { SalonServicesService } from './salon-services.service';

@Module({
  controllers: [SalonServicesController],
  providers: [SalonServicesRepository, SalonServicesService],
  exports: [SalonServicesRepository, SalonServicesService],
})
export class SalonServicesModule {}
