export const USERS_ERROR_MESSAGES = {
  EMAIL_ALREADY_IN_USE: 'This email address is already in use.',
  USER_NOT_FOUND: 'User not found.',
  CANNOT_DEACTIVATE_SELF: 'You cannot deactivate your own account.',
  CANNOT_DELETE_SELF: 'You cannot delete your own account.',
  ROLE_ALREADY_ASSIGNED: 'This role is already assigned to the user.',
  ROLE_NOT_ASSIGNED: 'This role is not assigned to the user.',
  INVALID_ROLE_ASSIGNMENT: 'You are not allowed to assign this role.',
  CANNOT_MANAGE_USER: 'You are not allowed to manage this user.',
  INVALID_CURRENT_PASSWORD: 'Current password is incorrect.',
  CANNOT_UPDATE_OWN_ROLE: 'You cannot change your own role.',
  CANNOT_UPDATE_OWN_STATUS: 'You cannot change your own account status.',
} as const;
