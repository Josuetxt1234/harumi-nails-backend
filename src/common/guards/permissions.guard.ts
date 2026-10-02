import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ERROR_MESSAGES } from '../constants/auth.constants';
import { PERMISSIONS_KEY } from '../constants/permissions.constants';
import { PERMISSIONS_MATCH_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const matchMode =
      this.reflector.getAllAndOverride<'all' | 'any'>(PERMISSIONS_MATCH_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'all';

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    const hasRequiredPermissions =
      matchMode === 'any'
        ? requiredPermissions.some((permission) =>
            user.permissions.includes(permission),
          )
        : requiredPermissions.every((permission) =>
            user.permissions.includes(permission),
          );

    if (!hasRequiredPermissions) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    return true;
  }
}
