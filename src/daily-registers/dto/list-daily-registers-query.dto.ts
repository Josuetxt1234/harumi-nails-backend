import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ListDailyRegistersQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'date must be a valid ISO date string.' })
  date?: string;

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
