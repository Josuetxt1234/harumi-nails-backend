import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryServicesDto {
  @IsOptional()
  @IsString({ message: 'Search must be a string.' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Category must be a string.' })
  category?: string;

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
  @IsBoolean({ message: 'isActive must be a boolean value.' })
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer.' })
  @Min(1, { message: 'Page must be at least 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer.' })
  @Min(1, { message: 'Limit must be at least 1.' })
  @Max(100, { message: 'Limit cannot exceed 100.' })
  limit?: number = 20;
}
