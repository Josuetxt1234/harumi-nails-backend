import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdvancesController } from './advances.controller';
import { AdvancesRepository } from './advances.repository';
import { AdvancesService } from './advances.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AdvancesController],
  providers: [AdvancesRepository, AdvancesService],
  exports: [AdvancesService, AdvancesRepository],
})
export class AdvancesModule {}
