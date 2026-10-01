export const IS_PUBLIC_KEY = 'isPublic';
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_INACTIVE: 'This account is inactive.',
  ACCOUNT_DEACTIVATED: 'This account has been deactivated.',
  NO_ROLES_ASSIGNED: 'This account has no active roles assigned.',
  INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token.',
  SESSION_REVOKED: 'This session has been revoked.',
  UNAUTHORIZED: 'Unauthorized access.',
  USER_NOT_FOUND: 'User not found.',
} as const;
