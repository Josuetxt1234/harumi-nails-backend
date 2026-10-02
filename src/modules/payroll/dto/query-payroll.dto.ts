import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PayrollStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryPayrollDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'mesaUserId must be a valid UUID.' })
  mesaUserId?: string;

  @IsOptional()
  @IsEnum(PayrollStatus, {
    message: 'status must be DRAFT, CLOSED or PAID.',
  })
  status?: PayrollStatus;
}
