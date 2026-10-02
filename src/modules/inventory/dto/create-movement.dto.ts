import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { InventoryMovementType } from '@prisma/client';

export class CreateMovementDto {
  @IsUUID('4', { message: 'materialId must be a valid UUID.' })
  materialId!: string;

  @IsEnum(InventoryMovementType, {
    message: 'type must be IN, OUT or ADJUSTMENT.',
  })
  type!: InventoryMovementType;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'quantity must be a number with up to 2 decimals.' },
  )
  @Min(0.01, { message: 'quantity must be greater than 0.' })
  quantity!: number;

  @IsString({ message: 'reason must be a string.' })
  @IsNotEmpty({ message: 'reason is required.' })
  reason!: string;
}
