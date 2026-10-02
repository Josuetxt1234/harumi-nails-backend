import { Global, Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  providers: [PermissionsGuard, RolesGuard],
  exports: [PermissionsGuard, RolesGuard],
})
export class CommonModule {}
