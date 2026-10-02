import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MaterialUnit } from '@prisma/client';

export class CreateMaterialDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'code must be a string.' })
  @IsNotEmpty({ message: 'code is required.' })
  code!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'name must be a string.' })
  @IsNotEmpty({ message: 'name is required.' })
  name!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'description must be a string.' })
  description?: string;

  @IsUUID('4', { message: 'categoryId must be a valid UUID.' })
  categoryId!: string;

  @IsEnum(MaterialUnit, {
    message: 'unit must be UNIT, ML, GRAMS, PAIR, BOX or BOTTLE.',
  })
  unit!: MaterialUnit;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'minimumStock must be a number with up to 2 decimals.' },
  )
  @Min(0, { message: 'minimumStock must be greater than or equal to 0.' })
  minimumStock!: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'costPrice must be a number with up to 2 decimals.' },
  )
  @Min(0, { message: 'costPrice must be greater than or equal to 0.' })
  costPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'initialStock must be a number with up to 2 decimals.' },
  )
  @Min(0, { message: 'initialStock must be greater than or equal to 0.' })
  initialStock?: number;
}
