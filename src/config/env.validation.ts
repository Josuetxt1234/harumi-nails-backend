import { Logger } from '@nestjs/common';
import * as Joi from 'joi';
import {
  AUTH_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_TTL_MS,
} from '../common/constants/rate-limit.constants';

const MIN_SECRET_LENGTH = 32;

// Mirrors MIN_PASSWORD_LENGTH in prisma/seed-credentials.ts.
const MIN_SEED_PASSWORD_LENGTH = 8;

const duration = (fallback: string) =>
  Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default(fallback)
    .messages({
      'string.pattern.base':
        '"{{#label}}" must be a duration such as 15m, 12h or 30d',
    });

const secret = Joi.string().min(MIN_SECRET_LENGTH).messages({
  'string.min': `"{{#label}}" must be at least ${MIN_SECRET_LENGTH} characters long`,
});

// Consumed by `prisma db seed` and the e2e scripts, never by the running API,
// so they are optional here: the seed itself fails when one is missing. An
// empty value is treated as "not set" by prisma/seed-credentials.ts.
const seedPassword = Joi.string()
  .min(MIN_SEED_PASSWORD_LENGTH)
  .allow('')
  .messages({
    'string.min': `"{{#label}}" must be at least ${MIN_SEED_PASSWORD_LENGTH} characters long`,
  });

const seedEmail = Joi.string().email().allow('');

const requiredInProduction = (schema: Joi.Schema) =>
  schema.when('NODE_ENV', { is: 'production', then: schema.required() });

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  SALON_TIMEZONE: Joi.string().default('America/Guayaquil'),
  TRUST_PROXY: Joi.string().default('false'),

  DATABASE_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\/.+/)
    .required()
    .messages({
      'string.pattern.base':
        '"{{#label}}" must be a PostgreSQL connection string',
    }),

  JWT_ACCESS_SECRET: secret.required(),
  JWT_REFRESH_SECRET: secret.optional(),
  JWT_ACCESS_EXPIRES_IN: duration('15m'),
  JWT_REFRESH_REMEMBER_EXPIRES_IN: duration('30d'),
  JWT_REFRESH_SESSION_EXPIRES_IN: duration('1d'),

  FRONTEND_URL: Joi.string().uri().allow(''),
  ALLOWED_ORIGINS: Joi.string().allow(''),

  COOKIE_SAMESITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default('strict'),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_DOMAIN: Joi.string().allow(''),
  REFRESH_REUSE_GRACE_MS: Joi.number().integer().min(0).default(1000),

  RATE_LIMIT_TTL: Joi.number()
    .integer()
    .min(1000)
    .default(DEFAULT_RATE_LIMIT_TTL_MS)
    .messages({
      'number.min':
        '"{{#label}}" is a window in milliseconds, not seconds, and must be at least 1000 (use 60000 for one minute)',
    }),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(DEFAULT_RATE_LIMIT_MAX),
  AUTH_RATE_LIMIT_MAX: Joi.number()
    .integer()
    .min(1)
    .default(AUTH_RATE_LIMIT_MAX),

  SEED_SUPER_ADMIN_PASSWORD: seedPassword,
  SEED_ADMIN_PASSWORD: seedPassword,
  SEED_MESA_PASSWORD: seedPassword,
  SEED_DEMO_PASSWORD: seedPassword,
  SEED_ADMIN_EMAIL: seedEmail,
  SEED_MESA_EMAIL: seedEmail,
  SEED_DEMO_ADMIN_EMAIL: seedEmail,
  SEED_DEMO_MESA_EMAIL: seedEmail,
  E2E_USER_PASSWORD: seedPassword,

  EMAIL_ENABLED: Joi.boolean().default(false),
  EMAIL_FROM: Joi.string().allow(''),
  EMAIL_HOST: Joi.string().allow(''),
  EMAIL_PORT: Joi.number().port().default(587),
  EMAIL_SECURE: Joi.boolean().default(false),
  EMAIL_USER: Joi.string().allow(''),
  EMAIL_PASSWORD: Joi.string().allow(''),
  EMAIL_TEST_TO: seedEmail,

  CLOUDINARY_CLOUD_NAME: requiredInProduction(Joi.string()),
  CLOUDINARY_API_KEY: requiredInProduction(Joi.string()),
  CLOUDINARY_API_SECRET: requiredInProduction(Joi.string()),
  CLOUDINARY_AVATARS_FOLDER: Joi.string().default('harumi-nails/avatars'),
}).unknown(true);

export const validateEnv = (
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const { error, value } = envSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  const issues = error?.details.map((detail) => detail.message) ?? [];

  if (
    value.NODE_ENV === 'production' &&
    !value.ALLOWED_ORIGINS &&
    !value.FRONTEND_URL
  ) {
    issues.push(
      '"ALLOWED_ORIGINS" or "FRONTEND_URL" is required when NODE_ENV is production',
    );
  }

  if (issues.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${issues
        .map((issue) => `  - ${issue}`)
        .join('\n')}`,
    );
  }

  if (value.EMAIL_ENABLED && !(value.EMAIL_USER && value.EMAIL_PASSWORD)) {
    new Logger('EnvValidation').warn(
      'EMAIL_ENABLED is true but EMAIL_USER / EMAIL_PASSWORD are empty: outgoing email will fail.',
    );
  }

  return value;
};
