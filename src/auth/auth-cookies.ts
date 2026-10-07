import { CookieOptions, Request, Response } from 'express';
import { IssuedRefreshToken } from './interfaces/auth-response.interface';

export const REFRESH_TOKEN_COOKIE = 'harumi_refresh_token';

export interface RefreshCookieConfig {
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  domain?: string;
  path: string;
}

const baseOptions = (config: RefreshCookieConfig): CookieOptions => ({
  httpOnly: true,
  secure: config.secure,
  sameSite: config.sameSite,
  domain: config.domain,
  path: config.path,
});

export const readRefreshTokenCookie = (request: Request): string | undefined => {
  const cookies = (request as Request & { cookies?: Record<string, string> })
    .cookies;

  return cookies?.[REFRESH_TOKEN_COOKIE];
};

export const setRefreshTokenCookie = (
  response: Response,
  issued: IssuedRefreshToken,
  config: RefreshCookieConfig,
): void => {
  response.cookie(REFRESH_TOKEN_COOKIE, issued.refreshToken, {
    ...baseOptions(config),
    // Without rememberMe the cookie dies with the browser session, mirroring
    // the previous sessionStorage behaviour.
    ...(issued.rememberMe ? { expires: issued.expiresAt } : {}),
  });
};

export const clearRefreshTokenCookie = (
  response: Response,
  config: RefreshCookieConfig,
): void => {
  response.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions(config));
};
