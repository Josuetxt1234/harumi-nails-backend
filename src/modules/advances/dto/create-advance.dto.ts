import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAdvanceDto {
  @IsUUID('4', { message: 'mesaUserId must be a valid UUID.' })
  mesaUserId!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a number with up to 2 decimals.' },
  )
  @Min(0.01, { message: 'amount must be greater than 0.' })
  amount!: number;

  @IsOptional()
  @IsString({ message: 'reason must be a string.' })
  reason?: string;

  @IsOptional()
  @IsDateString({}, { message: 'date must be a valid DateTime.' })
  date?: string;
}
