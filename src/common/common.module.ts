import { Global, Module } from '@nestjs/common';
import { AuthorizationRequiredGuard } from './guards/authorization-required.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  providers: [AuthorizationRequiredGuard, PermissionsGuard, RolesGuard],
  exports: [AuthorizationRequiredGuard, PermissionsGuard, RolesGuard],
})
export class CommonModule {}
