export const DEFAULT_RATE_LIMIT_TTL_MS = 60_000;
export const DEFAULT_RATE_LIMIT_MAX = 100;

export const AUTH_RATE_LIMIT_TTL_MS = 60_000;
export const AUTH_RATE_LIMIT_MAX = 5;

export const RATE_LIMIT_ERROR_MESSAGE =
  'Too many requests. Please try again later.';

// Resolved per request so AUTH_RATE_LIMIT_MAX can be overridden from .env,
// which is loaded after the controller decorators are evaluated.
export const resolveAuthRateLimitMax = (): number => {
  const configured = Number(process.env.AUTH_RATE_LIMIT_MAX);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : AUTH_RATE_LIMIT_MAX;
};
