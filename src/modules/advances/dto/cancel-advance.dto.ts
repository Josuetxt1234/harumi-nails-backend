import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CancelAdvanceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'reason must be a string.' })
  @IsNotEmpty({ message: 'reason is required.' })
  @MinLength(10, { message: 'reason must be at least 10 characters.' })
  reason!: string;
}
