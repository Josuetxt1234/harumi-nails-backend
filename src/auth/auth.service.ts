import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AUTH_ERROR_MESSAGES } from '../common/constants/auth.constants';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { HashingService } from '../hashing/hashing.service';
import { UsersService } from '../users/users.service';
import { UserWithRoles } from '../users/interfaces/user-with-roles.interface';
import { LoginDto } from './dto/login.dto';
import {
  AuthResult,
  AuthUserResponse,
} from './interfaces/auth-response.interface';
import { SessionMetadata } from './interfaces/session-metadata.interface';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly hashingService: HashingService,
  ) {}

  async login(
    loginDto: LoginDto,
    metadata: SessionMetadata = {},
  ): Promise<AuthResult> {
    const user = await this.usersService.findActiveByEmail(loginDto.email);

    // Both branches run one bcrypt comparison at the same cost factor, so a
    // missing account cannot be told apart from a wrong password by timing.
    const isPasswordValid =
      await this.usersService.verifyPasswordForAuthentication(
        loginDto.password,
        user,
      );

    if (!this.isAuthenticationSuccessful(user, isPasswordValid)) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // Converges legacy hashes towards the current cost, which is what keeps the
    // real comparison and the decoy comparison the same length over time.
    await this.usersService.upgradePasswordHashIfNeeded(user, loginDto.password);

    return this.issueAuthResponse(
      user,
      metadata,
      loginDto.rememberMe ?? false,
    );
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const refreshTokenHash = this.hashingService.hashSha256(refreshToken);
    const consumption =
      await this.sessionService.consumeRefreshToken(refreshTokenHash);

    if (consumption.status === 'reused') {
      const revokedSessions =
        await this.sessionService.revokeAllSessionsForUser(
          consumption.session.userId,
        );

      this.logger.warn(
        `Refresh token reuse detected for user ${consumption.session.userId}. ` +
          `Revoked ${revokedSessions} active session(s).`,
      );

      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.SESSION_COMPROMISED);
    }

    if (consumption.status !== 'consumed') {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      );
    }

    const { session } = consumption;
    const user = await this.usersService.getActiveProfileById(session.userId);

    if (!user || user.roles.length === 0) {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      );
    }

    return this.issueAuthResponse(
      user,
      {
        userAgent: session.userAgent ?? undefined,
        ipAddress: session.ipAddress ?? undefined,
      },
      this.tokenService.isRememberMeSession(session),
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

  private isAuthenticationSuccessful(
    user: UserWithRoles | null,
    isPasswordValid: boolean,
  ): user is UserWithRoles {
    return Boolean(
      user && isPasswordValid && user.isActive && user.roles.length > 0,
    );
  }

  private async issueAuthResponse(
    user: Pick<UserWithRoles, 'id'>,
    metadata: SessionMetadata,
    rememberMe = false,
  ): Promise<AuthResult> {
    const profile = await this.usersService.getActiveProfileOrFail(user.id);

    const refreshToken = this.hashingService.generateRandomToken();
    const refreshTokenHash = this.hashingService.hashSha256(refreshToken);
    const expiresAt =
      this.tokenService.getRefreshTokenExpirationDate(rememberMe);

    const session = await this.sessionService.createSession(
      profile.id,
      refreshTokenHash,
      expiresAt,
      metadata,
    );

    const payload: JwtPayload = {
      sub: profile.id,
      email: profile.email,
      roles: profile.roles,
      sid: session.id,
    };

    const tokens = await this.tokenService.generateAccessToken(payload);

    return {
      body: {
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
          mustChangePassword: profile.mustChangePassword,
        },
      },
      refreshToken: {
        refreshToken,
        expiresAt,
        rememberMe,
      },
    };
  }
}
