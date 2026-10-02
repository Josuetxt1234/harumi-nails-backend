import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryRepository, InventoryService],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
