import {
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_TTL_MS,
} from '../common/constants/rate-limit.constants';

const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

const parseAllowedOrigins = (): string[] => {
  const configured = [process.env.ALLOWED_ORIGINS, process.env.FRONTEND_URL]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configured.length > 0) {
    return [...new Set(configured)];
  }

  return process.env.NODE_ENV === 'production' ? [] : DEVELOPMENT_ORIGINS;
};

const parseTrustProxy = (): boolean | number | string => {
  const raw = process.env.TRUST_PROXY?.trim();

  if (!raw || raw === 'false') {
    return false;
  }

  if (raw === 'true') {
    return true;
  }

  const hops = Number(raw);

  return Number.isInteger(hops) && hops >= 0 ? hops : raw;
};

const parseRefreshCookie = () => {
  const raw = process.env.COOKIE_SAMESITE?.trim().toLowerCase();
  const sameSite = raw === 'lax' || raw === 'none' ? raw : 'strict';

  return {
    // Browsers drop SameSite=None cookies that are not marked Secure.
    secure:
      sameSite === 'none' ||
      process.env.COOKIE_SECURE?.trim() === 'true' ||
      process.env.NODE_ENV === 'production',
    sameSite,
    domain: process.env.COOKIE_DOMAIN?.trim() || undefined,
    path: '/api/auth',
  };
};

export default () => ({
  security: {
    allowedOrigins: parseAllowedOrigins(),
    trustProxy: parseTrustProxy(),
    refreshCookie: parseRefreshCookie(),
    rateLimit: {
      ttl: parseInt(
        process.env.RATE_LIMIT_TTL ?? `${DEFAULT_RATE_LIMIT_TTL_MS}`,
        10,
      ),
      limit: parseInt(
        process.env.RATE_LIMIT_MAX ?? `${DEFAULT_RATE_LIMIT_MAX}`,
        10,
      ),
    },
  },
});
