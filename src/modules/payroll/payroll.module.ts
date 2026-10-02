import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PayrollController } from './payroll.controller';
import { PayrollRepository } from './payroll.repository';
import { PayrollService } from './payroll.service';

@Module({
  imports: [PrismaModule],
  controllers: [PayrollController],
  providers: [PayrollRepository, PayrollService],
  exports: [PayrollService, PayrollRepository],
})
export class PayrollModule {}
