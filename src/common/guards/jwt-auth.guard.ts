import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import {
  IS_OPTIONAL_AUTH_KEY,
  IS_PUBLIC_KEY,
} from '../constants/auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic && !isOptionalAuth) {
      return true;
    }

    try {
      const isAuthenticated = await this.activateJwt(context);

      if (isAuthenticated || isOptionalAuth) {
        return true;
      }

      return false;
    } catch (error) {
      if (isOptionalAuth) {
        return true;
      }

      throw error;
    }
  }

  private async activateJwt(context: ExecutionContext): Promise<boolean> {
    const result = super.canActivate(context);

    if (typeof result === 'boolean') {
      return result;
    }

    if (result instanceof Observable) {
      return new Promise<boolean>((resolve, reject) => {
        result.subscribe({
          next: resolve,
          error: reject,
        });
      });
    }

    return result;
  }
}
