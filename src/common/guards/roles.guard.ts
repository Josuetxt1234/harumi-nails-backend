import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ERROR_MESSAGES } from '../constants/auth.constants';
import { SYSTEM_ROLES } from '../constants/roles.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

const ROLE_ALIASES: Record<string, string> = {
  SUPERADMIN: SYSTEM_ROLES.SUPER_ADMIN,
  SUPER_ADMIN: SYSTEM_ROLES.SUPER_ADMIN,
  ADMIN: SYSTEM_ROLES.ADMIN,
  MESA: SYSTEM_ROLES.MESA,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    const allowed = new Set(
      requiredRoles.map((role) => ROLE_ALIASES[role.toUpperCase()] ?? role),
    );
    const hasRole = user.roles.some((role) => allowed.has(role));

    if (!hasRole) {
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    return true;
  }
}
