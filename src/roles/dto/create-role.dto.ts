import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @IsString({ message: 'Role name must be a string.' })
  @IsNotEmpty({ message: 'Role name is required.' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  description?: string;
}
