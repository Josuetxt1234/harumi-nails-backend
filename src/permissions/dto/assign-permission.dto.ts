import { IsUUID } from 'class-validator';

export class AssignPermissionDto {
  @IsUUID('4', { message: 'permissionId must be a valid UUID.' })
  permissionId!: string;
}
