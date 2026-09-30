import { IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString({ message: 'Role name must be a string.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  description?: string;
}
