export const ADVANCES_ERROR_MESSAGES = {
  MESA_USER_NOT_FOUND: 'mesaUserId must reference an active user.',
  ADVANCE_NOT_FOUND: 'Advance not found.',
  CANNOT_CANCEL: 'Voucher cannot be cancelled',
  CANNOT_CANCEL_APPLIED: 'Voucher cannot be cancelled',
  CANNOT_CANCEL_NON_PENDING: 'Voucher cannot be cancelled',
  CANNOT_DELETE_APPLIED: 'Voucher already applied or cancelled',
  PREVIOUS_DAY_FORBIDDEN:
    'Only Super Admin can cancel vouchers from previous days',
  INVALID_DATE_RANGE:
    'startDate and endDate must be valid dates, and startDate cannot be after endDate.',
} as const;
