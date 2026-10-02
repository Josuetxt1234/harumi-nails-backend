import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CatalogStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FilterMaterialsDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID.' })
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean({ message: 'lowStockOnly must be a boolean.' })
  lowStockOnly?: boolean;

  @IsOptional()
  @IsEnum(CatalogStatus, { message: 'status must be ACTIVE or INACTIVE.' })
  status?: CatalogStatus;
}
