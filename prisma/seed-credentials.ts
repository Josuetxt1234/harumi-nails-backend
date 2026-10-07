import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const MIN_PASSWORD_LENGTH = 8;

/**
 * Seed passwords are never hardcoded: every environment, including staging and
 * production, must declare them explicitly or the seed refuses to run.
 */
function requirePassword(name: string, fallbackName?: string): string {
  const value = process.env[name]?.trim() || process.env[fallbackName ?? '']?.trim();

  if (!value) {
    const names = fallbackName ? `${name} (or ${fallbackName})` : name;

    throw new Error(
      `Missing ${names}. Export it before seeding, for example:\n` +
        `  $env:${name}="<a strong password>"   # PowerShell\n` +
        `  export ${name}='<a strong password>' # bash`,
    );
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }

  return value;
}

function readEmail(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const seedSuperAdminPassword = (): string =>
  requirePassword('SEED_SUPER_ADMIN_PASSWORD', 'SEED_ADMIN_PASSWORD');

export const seedAdminPassword = (): string =>
  requirePassword('SEED_ADMIN_PASSWORD');

export const seedMesaPassword = (): string =>
  requirePassword('SEED_MESA_PASSWORD');

export const seedDemoPassword = (): string =>
  requirePassword('SEED_DEMO_PASSWORD', 'SEED_ADMIN_PASSWORD');

export const seedAdminAccount = () => ({
  email: readEmail('SEED_ADMIN_EMAIL', 'admin@haruminails.com'),
  password: seedAdminPassword(),
});

export const seedMesaAccount = () => ({
  email: readEmail('SEED_MESA_EMAIL', 'mesa10@haruminails.com'),
  password: seedMesaPassword(),
});

export const demoAdminAccount = () => ({
  email: readEmail('SEED_DEMO_ADMIN_EMAIL', 'admin@harumi.com'),
  password: seedDemoPassword(),
});

export const demoMesaAccount = () => ({
  email: readEmail('SEED_DEMO_MESA_EMAIL', 'gabriela.rios@harumi.com'),
  password: seedDemoPassword(),
});

/**
 * Throwaway password for the users an E2E run creates and then deletes. It is
 * generated per run so no test credential ever lands in the repository.
 */
export const generateTestPassword = (): string =>
  process.env.E2E_USER_PASSWORD?.trim() ||
  `E2e!${randomBytes(9).toString('base64url')}A9`;
