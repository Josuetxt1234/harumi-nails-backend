import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID('4', { message: 'Role ID must be a valid UUID.' })
  @IsNotEmpty({ message: 'Role ID is required.' })
  roleId!: string;
}
