import { IsOptional, IsString } from 'class-validator';

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString({ message: 'Phone must be a string.' })
  phone?: string;
}
