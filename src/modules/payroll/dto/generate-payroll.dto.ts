import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GeneratePayrollDto {
  @IsUUID('4', { message: 'mesaUserId must be a valid UUID.' })
  mesaUserId!: string;

  @IsOptional()
  @IsDateString({}, { message: 'periodStart must be a valid Date or ISO string.' })
  periodStart?: string;

  @IsOptional()
  @IsDateString({}, { message: 'periodEnd must be a valid Date or ISO string.' })
  periodEnd?: string;
}
