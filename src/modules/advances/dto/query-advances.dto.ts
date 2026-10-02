import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { AdvanceStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toCalendarDateString } from '../../../common/utils/date.util';

function transformCalendarDate({
  value,
}: {
  value: unknown;
}): string | undefined {
  return typeof value === 'string' ? toCalendarDateString(value) : undefined;
}

export class QueryAdvancesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'mesaUserId must be a valid UUID.' })
  mesaUserId?: string;

  @IsOptional()
  @IsEnum(AdvanceStatus, {
    message: 'status must be PENDING, APPLIED or CANCELLED.',
  })
  status?: AdvanceStatus;

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
