export const WEEKEND_BONUS_RATE = 0.05;

export const PAYROLL_ERROR_MESSAGES = {
  MESA_USER_NOT_FOUND: 'mesaUserId must reference an active user.',
  PAYROLL_NOT_FOUND: 'Payroll not found.',
  PERIOD_ALREADY_CLOSED: 'Payroll has already been generated',
  INVALID_PERIOD: 'periodStart and periodEnd must be valid dates.',
  CANNOT_CLOSE_NON_DRAFT: 'Only a DRAFT payroll can be closed.',
  PAYROLL_ID_MISMATCH: 'payrollId does not match the route parameter.',
} as const;
