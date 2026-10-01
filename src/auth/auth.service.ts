import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_ERROR_MESSAGES } from '../common/constants/auth.constants';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { HashingService } from '../hashing/hashing.service';
import { UsersService } from '../users/users.service';
import { UserWithRoles } from '../users/interfaces/user-with-roles.interface';
import { LoginDto } from './dto/login.dto';
import {
  AuthUserResponse,
  LoginResponse,
} from './interfaces/auth-response.interface';
import { SessionMetadata } from './interfaces/session-metadata.interface';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly hashingService: HashingService,
  ) {}

  async login(
    loginDto: LoginDto,
    metadata: SessionMetadata = {},
  ): Promise<LoginResponse> {
    const user = await this.usersService.findActiveByEmail(loginDto.email);

    this.usersService.assertUserExistsForAuthentication(user);
    this.usersService.assertUserIsActive(user);

    const isPasswordValid = await this.usersService.verifyPassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    this.usersService.assertUserHasRoles(user);

    return this.issueAuthResponse(user, metadata, loginDto.rememberMe ?? false);
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const refreshTokenHash = this.hashingService.hashSha256(refreshToken);
    const session =
      await this.sessionService.findActiveByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const user = await this.usersService.getActiveProfileOrFail(session.userId);
    this.usersService.assertUserHasRoles(user);

    await this.sessionService.revokeSession(session.id, session.userId);

    const rememberMe = this.tokenService.isRememberMeSession(session);

    return this.issueAuthResponse(
      user,
      {
        userAgent: session.userAgent ?? undefined,
        ipAddress: session.ipAddress ?? undefined,
      },
      rememberMe,
    );
  }

  async logout(refreshToken: string, userId?: string): Promise<void> {
    const refreshTokenHash = this.hashingService.hashSha256(refreshToken);
    await this.sessionService.revokeSessionByRefreshTokenHash(
      refreshTokenHash,
      userId,
    );
  }

  async getProfile(userId: string): Promise<AuthUserResponse> {
    return this.usersService.getActiveProfileOrFail(userId);
  }

  private async issueAuthResponse(
    user: Pick<UserWithRoles, 'id'>,
    metadata: SessionMetadata,
    rememberMe = false,
  ): Promise<LoginResponse> {
    const profile = await this.usersService.getActiveProfileOrFail(user.id);

    const payload: JwtPayload = {
      sub: profile.id,
      email: profile.email,
      roles: profile.roles,
    };

    const refreshToken = this.hashingService.generateRandomToken();
    const refreshTokenHash = this.hashingService.hashSha256(refreshToken);
    const expiresAt =
      this.tokenService.getRefreshTokenExpirationDate(rememberMe);

    await this.sessionService.createSession(
      user.id,
      refreshTokenHash,
      expiresAt,
      metadata,
    );

    const tokens = await this.tokenService.buildAuthTokens(
      payload,
      refreshToken,
    );

    return {
      ...tokens,
      user: {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        roles: profile.roles,
        permissions: profile.permissions,
      },
    };
  }
}
