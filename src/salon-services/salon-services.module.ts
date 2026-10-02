import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalonServicesController } from './salon-services.controller';
import { SalonServicesRepository } from './salon-services.repository';
import { SalonServicesService } from './salon-services.service';

@Module({
  imports: [PrismaModule],
  controllers: [SalonServicesController],
  providers: [SalonServicesRepository, SalonServicesService],
  exports: [SalonServicesRepository, SalonServicesService],
})
export class SalonServicesModule {}
