import { IsUUID } from 'class-validator';

export class ClosePayrollDto {
  @IsUUID('4', { message: 'payrollId must be a valid UUID.' })
  payrollId!: string;
}
