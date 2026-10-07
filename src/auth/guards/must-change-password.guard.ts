import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/constants/auth.constants';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ALLOW_TEMPORARY_PASSWORD_KEY } from '../decorators/allow-temporary-password.decorator';

export const MUST_CHANGE_PASSWORD_MESSAGE =
  'Debes cambiar tu contraseña temporal antes de acceder a este recurso.';

/**
 * Routes that stay open while the password is still temporary, declared by
 * method and by the path Nest registers them under, without the global
 * prefix. They back up `@AllowTemporaryPassword()`: dropping the decorator by
 * accident would otherwise lock every holder of a temporary password out of
 * logging out or changing it, with no way back in.
 */
const TEMPORARY_PASSWORD_ROUTES: ReadonlyArray<{
  method: string;
  path: string;
}> = [
  { method: 'GET', path: '/auth/me' },
  { method: 'POST', path: '/auth/refresh' },
  { method: 'POST', path: '/auth/logout' },
  { method: 'PATCH', path: '/users/me/password' },
];

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    if (this.isExempt(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    // Unauthenticated requests are not this guard's business: JwtAuthGuard
    // already ran and either let a public route through or rejected the call.
    if (!user?.mustChangePassword) {
      return true;
    }

    if (this.isTemporaryPasswordRoute(request)) {
      return true;
    }

    throw new ForbiddenException(MUST_CHANGE_PASSWORD_MESSAGE);
  }

  private isExempt(context: ExecutionContext): boolean {
    return [IS_PUBLIC_KEY, ALLOW_TEMPORARY_PASSWORD_KEY].some((key) =>
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }

  private isTemporaryPasswordRoute(request: Request): boolean {
    const method = request.method.toUpperCase();
    // `route.path` is the registered pattern rather than the requested url, so
    // query strings and path params never reach the comparison. It carries the
    // global prefix, which is why the allowlist is matched as a suffix.
    const path = (request.route?.path ?? request.path).replace(/\/+$/, '');

    return TEMPORARY_PASSWORD_ROUTES.some(
      (route) => route.method === method && path.endsWith(route.path),
    );
  }
}
