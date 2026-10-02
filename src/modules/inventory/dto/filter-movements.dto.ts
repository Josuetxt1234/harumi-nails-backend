import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { InventoryMovementType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toCalendarDateString } from '../../../common/utils/date.util';

function transformCalendarDate({
  value,
}: {
  value: unknown;
}): string | undefined {
  return typeof value === 'string' ? toCalendarDateString(value) : undefined;
}

export class FilterMovementsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'materialId must be a valid UUID.' })
  materialId?: string;

  @IsOptional()
  @IsEnum(InventoryMovementType, {
    message: 'type must be IN, OUT or ADJUSTMENT.',
  })
  type?: InventoryMovementType;

  @IsOptional()
  @Transform(transformCalendarDate)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be a valid YYYY-MM-DD or ISO calendar date.',
  })
  startDate?: string;

  @IsOptional()
  @Transform(transformCalendarDate)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be a valid YYYY-MM-DD or ISO calendar date.',
  })
  endDate?: string;
}
