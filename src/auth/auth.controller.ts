import { Request, Response } from 'express';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AUTH_ERROR_MESSAGES } from '../common/constants/auth.constants';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import {
  AUTH_RATE_LIMIT_TTL_MS,
  resolveAuthRateLimitMax,
} from '../common/constants/rate-limit.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  RefreshCookieConfig,
  setRefreshTokenCookie,
} from './auth-cookies';
import { AuthService } from './auth.service';
import { AllowTemporaryPassword } from './decorators/allow-temporary-password.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginFailureFilter } from './filters/login-failure.filter';
import { AuthResult, LoginResponse } from './interfaces/auth-response.interface';
import { SessionMetadata } from './interfaces/session-metadata.interface';

const STRICT_AUTH_THROTTLE = {
  default: {
    ttl: AUTH_RATE_LIMIT_TTL_MS,
    limit: resolveAuthRateLimitMax,
  },
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseFilters(LoginFailureFilter)
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(
      loginDto,
      this.extractSessionMetadata(request),
    );

    return this.commitAuthResult(response, result);
  }

  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const refreshToken =
      readRefreshTokenCookie(request) ?? refreshTokenDto.refreshToken;

    if (!refreshToken) {
      clearRefreshTokenCookie(response, this.refreshCookieConfig);
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      );
    }

    try {
      const result = await this.authService.refresh(refreshToken);

      return this.commitAuthResult(response, result);
    } catch (error) {
      clearRefreshTokenCookie(response, this.refreshCookieConfig);
      throw error;
    }
  }

  @OptionalAuth()
  @AllowTemporaryPassword()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<void> {
    const refreshToken =
      readRefreshTokenCookie(request) ?? refreshTokenDto.refreshToken;

    clearRefreshTokenCookie(response, this.refreshCookieConfig);

    if (refreshToken) {
      await this.authService.logout(refreshToken, user?.id);
    }
  }

  @Get('me')
  @AllowTemporaryPassword()
  @Permissions(PERMISSIONS.PROFILE_READ)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  private get refreshCookieConfig(): RefreshCookieConfig {
    return this.configService.getOrThrow<RefreshCookieConfig>(
      'security.refreshCookie',
    );
  }

  private commitAuthResult(
    response: Response,
    result: AuthResult,
  ): LoginResponse {
    setRefreshTokenCookie(
      response,
      result.refreshToken,
      this.refreshCookieConfig,
    );

    return result.body;
  }

  private extractSessionMetadata(request: Request): SessionMetadata {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim() ?? request.ip;

    return {
      userAgent: request.headers['user-agent'],
      ipAddress,
    };
  }
}
