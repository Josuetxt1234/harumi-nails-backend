import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Name must be a string.' })
  name?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Category must be a string.' })
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Price must be a number with up to 2 decimal places.' },
  )
  @Min(0, { message: 'Price must be at least 0.' })
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Commission percentage must be a number with up to 2 decimal places.',
    },
  )
  @Min(0, { message: 'Commission percentage must be at least 0.' })
  @Max(100, { message: 'Commission percentage cannot exceed 100.' })
  commissionPercentage?: number;
}
