import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateDailyRegisterItemDto {
  @IsUUID('4', { message: 'serviceId must be a valid UUID.' })
  serviceId!: string;

  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer.' })
  @Min(1, { message: 'quantity must be at least 1.' })
  quantity!: number;
}

export class CreateDailyRegisterDto {
  @IsOptional()
  @IsUUID('4', { message: 'mesaUserId must be a valid UUID.' })
  mesaUserId?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'clientName must be a string.' })
  @IsNotEmpty({ message: 'clientName is required.' })
  clientName!: string;

  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be CASH, TRANSFER or CARD.',
  })
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'discountAmount must be a number with up to 2 decimals.' },
  )
  @Min(0, { message: 'discountAmount must be greater than or equal to 0.' })
  discountAmount?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean({ message: 'hasCardFee must be a boolean.' })
  hasCardFee?: boolean;

  @IsArray({ message: 'items must be an array.' })
  @ArrayMinSize(1, { message: 'At least one item is required.' })
  @ValidateNested({ each: true })
  @Type(() => CreateDailyRegisterItemDto)
  items!: CreateDailyRegisterItemDto[];
}
