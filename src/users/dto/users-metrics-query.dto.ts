import { IsOptional, IsUUID } from 'class-validator';

export class UsersMetricsQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'roleId must be a valid UUID.' })
  roleId?: string;
}
