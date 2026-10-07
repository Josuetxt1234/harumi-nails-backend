import { SetMetadata } from '@nestjs/common';

export const ALLOW_TEMPORARY_PASSWORD_KEY = 'allowTemporaryPassword';

/**
 * Keeps a route reachable while the caller still holds a temporary password.
 *
 * Reserve it for the handlers needed to get rid of that password: anything
 * else would let an admin-issued credential be used as a permanent one.
 */
export const AllowTemporaryPassword = () =>
  SetMetadata(ALLOW_TEMPORARY_PASSWORD_KEY, true);
