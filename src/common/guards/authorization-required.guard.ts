import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_ERROR_MESSAGES,
  IS_OPTIONAL_AUTH_KEY,
  IS_PUBLIC_KEY,
} from '../constants/auth.constants';
import { PERMISSIONS_KEY } from '../constants/permissions.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';

const AUTHORIZATION_METADATA_KEYS = [
  IS_PUBLIC_KEY,
  IS_OPTIONAL_AUTH_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
];

@Injectable()
export class AuthorizationRequiredGuard implements CanActivate {
  private readonly logger = new Logger(AuthorizationRequiredGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const hasPolicy = AUTHORIZATION_METADATA_KEYS.some((key) =>
      this.isDeclared(
        this.reflector.getAllAndOverride<unknown>(key, [
          context.getHandler(),
          context.getClass(),
        ]),
      ),
    );

    if (hasPolicy) {
      return true;
    }

    this.logger.error(
      `${context.getClass().name}.${context.getHandler().name} declares no authorization policy. ` +
        'Add @Permissions(), @Roles(), @Public() or @OptionalAuth() to it.',
    );

    throw new ForbiddenException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
  }

  private isDeclared(value: unknown): boolean {
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }
}
