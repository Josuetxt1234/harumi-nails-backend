import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Session } from '@prisma/client';
import {
  AUTH_ERROR_MESSAGES,
  JWT_ALGORITHM,
} from '../common/constants/auth.constants';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { HashingService } from '../hashing/hashing.service';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly hashingService: HashingService,
  ) {}

  generateRefreshTokenValue(): string {
    return this.hashingService.generateRandomToken();
  }

  hashRefreshToken(refreshToken: string): string {
    return this.hashingService.hashSha256(refreshToken);
  }

  async generateAccessToken(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const expiresInConfig =
      this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const accessSecret = this.configService.get<string>('jwt.accessSecret');

    if (!accessSecret) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: expiresInConfig,
      algorithm: JWT_ALGORITHM,
    });

    return {
      accessToken,
      expiresIn: this.parseExpiresInToSeconds(expiresInConfig),
    };
  }

  getRefreshTokenExpirationDate(rememberMe = false): Date {
    const refreshExpiresIn = rememberMe
      ? this.configService.get<string>('jwt.refreshRememberExpiresIn') ?? '30d'
      : this.configService.get<string>('jwt.refreshSessionExpiresIn') ?? '1d';
    const milliseconds = this.parseExpiresInToMilliseconds(refreshExpiresIn);

    return new Date(Date.now() + milliseconds);
  }

  isRememberMeSession(session: Session): boolean {
    const sessionDurationMs =
      session.expiresAt.getTime() - session.createdAt.getTime();
    const standardSessionMs = this.parseExpiresInToMilliseconds(
      this.configService.get<string>('jwt.refreshSessionExpiresIn') ?? '1d',
    );

    return sessionDurationMs > standardSessionMs;
  }

  private parseExpiresInToSeconds(value: string): number {
    return Math.floor(this.parseExpiresInToMilliseconds(value) / 1000);
  }

  private parseExpiresInToMilliseconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());

    if (!match) {
      return 15 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
