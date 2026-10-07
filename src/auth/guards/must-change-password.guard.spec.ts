import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/constants/auth.constants';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ALLOW_TEMPORARY_PASSWORD_KEY } from '../decorators/allow-temporary-password.decorator';
import { MustChangePasswordGuard } from './must-change-password.guard';

interface ContextOptions {
  method?: string;
  path?: string;
  user?: Partial<AuthenticatedUser> | null;
  metadata?: string[];
}

function buildUser(mustChangePassword: boolean): AuthenticatedUser {
  return {
    id: 'c0ffee00-0000-4000-8000-000000000001',
    email: 'mesa@haruminails.com',
    roles: ['MESA'],
    permissions: [],
    mustChangePassword,
  };
}

function buildGuard(metadata: string[] = []) {
  const reflector = {
    getAllAndOverride: (key: string) => metadata.includes(key) || undefined,
  } as unknown as Reflector;

  return new MustChangePasswordGuard(reflector);
}

function buildContext({
  method = 'GET',
  path = '/api/daily-registers',
  user,
}: ContextOptions = {}): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ method, path, route: { path }, user }),
    }),
  } as unknown as ExecutionContext;
}

describe('MustChangePasswordGuard', () => {
  it('lets a settled account through', () => {
    const guard = buildGuard();

    expect(
      guard.canActivate(buildContext({ user: buildUser(false) })),
    ).toBe(true);
  });

  it('lets an unauthenticated request reach the next guard', () => {
    const guard = buildGuard();

    expect(guard.canActivate(buildContext({ user: undefined }))).toBe(true);
  });

  it('blocks a temporary password on a regular route', () => {
    const guard = buildGuard();
    const context = buildContext({ user: buildUser(true) });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Debes cambiar tu contraseña temporal antes de acceder a este recurso.',
    );
  });

  it.each([
    ['GET', '/api/auth/me'],
    ['POST', '/api/auth/refresh'],
    ['POST', '/api/auth/logout'],
    ['PATCH', '/api/users/me/password'],
  ])('allows %s %s while the password is temporary', (method, path) => {
    const guard = buildGuard();

    expect(
      guard.canActivate(
        buildContext({ method, path, user: buildUser(true) }),
      ),
    ).toBe(true);
  });

  it('does not confuse the method of an allowlisted path', () => {
    const guard = buildGuard();
    const context = buildContext({
      method: 'DELETE',
      path: '/api/auth/me',
      user: buildUser(true),
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it.each([IS_PUBLIC_KEY, ALLOW_TEMPORARY_PASSWORD_KEY])(
    'honours the %s metadata',
    (key) => {
      const guard = buildGuard([key]);

      expect(
        guard.canActivate(buildContext({ user: buildUser(true) })),
      ).toBe(true);
    },
  );

  it('ignores non-http contexts', () => {
    const guard = buildGuard();
    const context = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
