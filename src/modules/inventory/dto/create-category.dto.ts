import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { CatalogStatus } from '@prisma/client';

export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'name must be a string.' })
  @IsNotEmpty({ message: 'name is required.' })
  name!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'description must be a string.' })
  description?: string;

  @IsOptional()
  @IsEnum(CatalogStatus, { message: 'status must be ACTIVE or INACTIVE.' })
  status?: CatalogStatus;
}
