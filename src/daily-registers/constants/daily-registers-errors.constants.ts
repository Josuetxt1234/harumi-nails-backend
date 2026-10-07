export const DAILY_REGISTERS_ERROR_MESSAGES = {
  REGISTER_NOT_FOUND: 'Daily register not found.',
  REGISTER_FORBIDDEN: 'You are not allowed to access this daily register.',
  MESA_USER_REQUIRED: 'mesaUserId is required for admin users.',
  MESA_USER_INVALID: 'mesaUserId must reference an active user with MESA role.',
  INVALID_SERVICES: 'One or more services are invalid, inactive, or deleted.',
  DISCOUNT_EXCEEDS_SUBTOTAL: 'discountAmount cannot be greater than the subtotal.',
  INVALID_DATE_RANGE:
    'startDate and endDate must be valid YYYY-MM-DD dates, and startDate cannot be after endDate.',
} as const;
