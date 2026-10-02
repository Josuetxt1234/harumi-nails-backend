import { applyDecorators, SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../constants/permissions.constants';

export const PERMISSIONS_MATCH_KEY = 'permissionsMatch';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PermissionsAny = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MATCH_KEY, 'any'),
  );
