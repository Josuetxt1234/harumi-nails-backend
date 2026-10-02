import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { toCalendarDateString } from '../../common/utils/date.util';
import {
  DATE_RANGE_PRESETS,
  DateRangePreset,
} from '../constants/daily-registers.constants';

function transformCalendarDate({ value }: { value: unknown }): string | undefined {
  return typeof value === 'string' ? toCalendarDateString(value) : undefined;
}

function requiresCustomDates(query: ListDailyRegistersQueryDto): boolean {
  return (
    query.dateRange === 'CUSTOM' ||
    Boolean(query.startDate) ||
    Boolean(query.endDate)
  );
}

export class ListDailyRegistersQueryDto {
  @IsOptional()
  @IsIn(DATE_RANGE_PRESETS, {
    message:
      'dateRange must be TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH or CUSTOM.',
  })
  dateRange?: DateRangePreset = 'TODAY';

  @ValidateIf(requiresCustomDates)
  @Transform(transformCalendarDate)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be a valid YYYY-MM-DD or ISO calendar date.',
  })
  startDate?: string;

  @ValidateIf(requiresCustomDates)
  @Transform(transformCalendarDate)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be a valid YYYY-MM-DD or ISO calendar date.',
  })
  endDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'mesaUserId must be a valid UUID.' })
  mesaUserId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be CASH, TRANSFER or CARD.',
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer.' })
  @Min(1, { message: 'page must be at least 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(100, { message: 'limit cannot exceed 100.' })
  limit?: number = 50;
}
