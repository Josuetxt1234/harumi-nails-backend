import { Module } from '@nestjs/common';
import { SalonServicesModule } from '../salon-services/salon-services.module';
import { DailyRegistersController } from './daily-registers.controller';
import { DailyRegistersRepository } from './daily-registers.repository';
import { DailyRegistersService } from './daily-registers.service';

@Module({
  imports: [SalonServicesModule],
  controllers: [DailyRegistersController],
  providers: [DailyRegistersRepository, DailyRegistersService],
  exports: [DailyRegistersRepository, DailyRegistersService],
})
export class DailyRegistersModule {}
