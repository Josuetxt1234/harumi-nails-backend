import { Type } from 'class-transformer';
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

  @IsInt({ message: 'quantity must be an integer.' })
  @Min(1, { message: 'quantity must be at least 1.' })
  quantity!: number;
}

export class CreateDailyRegisterDto {
  @IsOptional()
  @IsUUID('4', { message: 'mesaUserId must be a valid UUID.' })
  mesaUserId?: string;

  @IsString({ message: 'clientName must be a string.' })
  @IsNotEmpty({ message: 'clientName is required.' })
  clientName!: string;

  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be CASH, TRANSFER or CARD.',
  })
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'discountAmount must be a number with up to 2 decimals.' },
  )
  @Min(0, { message: 'discountAmount must be greater than or equal to 0.' })
  discountAmount?: number;

  @IsOptional()
  @IsBoolean({ message: 'hasCardFee must be a boolean.' })
  hasCardFee?: boolean;

  @IsArray({ message: 'items must be an array.' })
  @ArrayMinSize(1, { message: 'At least one item is required.' })
  @ValidateNested({ each: true })
  @Type(() => CreateDailyRegisterItemDto)
  items!: CreateDailyRegisterItemDto[];
}
