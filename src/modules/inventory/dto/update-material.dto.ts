import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { CatalogStatus, MaterialUnit } from '@prisma/client';

export class UpdateMaterialDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'code must be a string.' })
  code?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'name must be a string.' })
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'description must be a string.' })
  description?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID.' })
  categoryId?: string;

  @IsOptional()
  @IsEnum(MaterialUnit, {
    message: 'unit must be UNIT, ML, GRAMS, PAIR, BOX or BOTTLE.',
  })
  unit?: MaterialUnit;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'minimumStock must be a number with up to 2 decimals.' },
  )
  @Min(0, { message: 'minimumStock must be greater than or equal to 0.' })
  minimumStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'costPrice must be a number with up to 2 decimals.' },
  )
  @Min(0, { message: 'costPrice must be greater than or equal to 0.' })
  costPrice?: number;

  @IsOptional()
  @IsEnum(CatalogStatus, { message: 'status must be ACTIVE or INACTIVE.' })
  status?: CatalogStatus;
}
