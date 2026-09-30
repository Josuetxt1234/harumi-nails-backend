export const ROLES_ERROR_MESSAGES = {
  ROLE_NOT_FOUND: 'Role not found.',
  ROLE_NAME_ALREADY_IN_USE: 'This role name is already in use.',
  ROLE_IN_USE: 'This role cannot be deleted because it is assigned to users.',
  PERMISSION_NOT_FOUND: 'Permission not found.',
  PERMISSION_ALREADY_ASSIGNED: 'This permission is already assigned to the role.',
  PERMISSION_NOT_ASSIGNED: 'This permission is not assigned to the role.',
} as const;
