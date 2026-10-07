import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AUTH_ERROR_MESSAGES,
  JWT_ALGORITHM,
} from '../../common/constants/auth.constants';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {
    const accessSecret = configService.get<string>('jwt.accessSecret');

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Access tokens are only valid while their session is: a logout, a reuse
    // detection or a password change invalidates them on the next request.
    if (!payload.sid) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.SESSION_REVOKED);
    }

    const isSessionActive = await this.sessionService.isSessionActive(
      payload.sid,
      payload.sub,
    );

    if (!isSessionActive) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.SESSION_REVOKED);
    }

    const user = await this.usersService.getActiveProfileOrFail(payload.sub);

    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
