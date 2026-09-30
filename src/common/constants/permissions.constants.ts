export const PERMISSIONS_KEY = 'permissions';

export const PERMISSIONS = {
  PROFILE_READ: 'profile.read',
  PROFILE_UPDATE: 'profile.update',
  PROFILE_CHANGE_PASSWORD: 'profile.change_password',

  USERS_LIST: 'users.list',
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_ACTIVATE: 'users.activate',
  USERS_DEACTIVATE: 'users.deactivate',
  USERS_FORCE_PASSWORD_RESET: 'users.force_password_reset',
  USERS_ASSIGN_ROLE: 'users.assign_role',
  USERS_REVOKE_ROLE: 'users.revoke_role',

  ROLES_LIST: 'roles.list',
  ROLES_READ: 'roles.read',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',

  PERMISSIONS_LIST: 'permissions.list',
  PERMISSIONS_READ: 'permissions.read',
  PERMISSIONS_ASSIGN_TO_ROLE: 'permissions.assign_to_role',

  SERVICES_LIST: 'services.list',
  SERVICES_CREATE: 'services.create',
  SERVICES_UPDATE: 'services.update',
  SERVICES_DELETE: 'services.delete',

  DAILY_REGISTERS_CREATE: 'daily_registers.create',
  DAILY_REGISTERS_LIST: 'daily_registers.list',
  DAILY_REGISTERS_READ: 'daily_registers.read',
  DAILY_REGISTERS_VOID: 'daily_registers.void',

  APPOINTMENTS_LIST: 'appointments.list',
  APPOINTMENTS_READ: 'appointments.read',
  APPOINTMENTS_CREATE: 'appointments.create',
  APPOINTMENTS_UPDATE: 'appointments.update',
  APPOINTMENTS_CANCEL: 'appointments.cancel',
  APPOINTMENTS_REASSIGN: 'appointments.reassign',

  POS_OPEN_REGISTER: 'pos.open_register',
  POS_CLOSE_REGISTER: 'pos.close_register',
  POS_CREATE_SALE: 'pos.create_sale',
  POS_READ_SALES: 'pos.read_sales',

  INVENTORY_LIST: 'inventory.list',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_REQUEST_RESTOCK: 'inventory.request_restock',

  PAYROLL_LIST: 'payroll.list',
  PAYROLL_READ: 'payroll.read',
  PAYROLL_CALCULATE: 'payroll.calculate',
  PAYROLL_APPROVE: 'payroll.approve',

  AUDIT_LIST: 'audit.list',
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionName[] = Object.values(PERMISSIONS);

const PROFILE_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.PROFILE_READ,
  PERMISSIONS.PROFILE_UPDATE,
  PERMISSIONS.PROFILE_CHANGE_PASSWORD,
];

const ADMIN_USER_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.USERS_LIST,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_ACTIVATE,
  PERMISSIONS.USERS_DEACTIVATE,
  PERMISSIONS.USERS_ASSIGN_ROLE,
  PERMISSIONS.USERS_REVOKE_ROLE,
];

const ADMIN_ROLE_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.ROLES_LIST,
  PERMISSIONS.ROLES_READ,
];

const ADMIN_DAILY_REGISTER_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.SERVICES_LIST,
  PERMISSIONS.DAILY_REGISTERS_CREATE,
  PERMISSIONS.DAILY_REGISTERS_LIST,
  PERMISSIONS.DAILY_REGISTERS_READ,
  PERMISSIONS.DAILY_REGISTERS_VOID,
];

export const ROLE_PERMISSION_MAP: Record<string, PermissionName[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: [
    ...PROFILE_PERMISSIONS,
    ...ADMIN_USER_PERMISSIONS,
    ...ADMIN_ROLE_PERMISSIONS,
    ...ADMIN_DAILY_REGISTER_PERMISSIONS,
  ],
  MESA: [
    ...PROFILE_PERMISSIONS,
    PERMISSIONS.SERVICES_LIST,
    PERMISSIONS.DAILY_REGISTERS_CREATE,
  ],
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionName, string> = {
  [PERMISSIONS.PROFILE_READ]: 'Read own profile',
  [PERMISSIONS.PROFILE_UPDATE]: 'Update own profile contact and avatar',
  [PERMISSIONS.PROFILE_CHANGE_PASSWORD]: 'Change own password',

  [PERMISSIONS.USERS_LIST]: 'List users',
  [PERMISSIONS.USERS_READ]: 'View user details',
  [PERMISSIONS.USERS_CREATE]: 'Create users',
  [PERMISSIONS.USERS_UPDATE]: 'Update users',
  [PERMISSIONS.USERS_DELETE]: 'Soft delete users',
  [PERMISSIONS.USERS_ACTIVATE]: 'Activate users',
  [PERMISSIONS.USERS_DEACTIVATE]: 'Deactivate users',
  [PERMISSIONS.USERS_FORCE_PASSWORD_RESET]: 'Force reset user passwords',
  [PERMISSIONS.USERS_ASSIGN_ROLE]: 'Assign roles to users',
  [PERMISSIONS.USERS_REVOKE_ROLE]: 'Revoke roles from users',

  [PERMISSIONS.ROLES_LIST]: 'List roles',
  [PERMISSIONS.ROLES_READ]: 'View role details',
  [PERMISSIONS.ROLES_CREATE]: 'Create roles',
  [PERMISSIONS.ROLES_UPDATE]: 'Update roles',
  [PERMISSIONS.ROLES_DELETE]: 'Delete roles',

  [PERMISSIONS.PERMISSIONS_LIST]: 'List permissions',
  [PERMISSIONS.PERMISSIONS_READ]: 'View permission details',
  [PERMISSIONS.PERMISSIONS_ASSIGN_TO_ROLE]: 'Assign permissions to roles',

  [PERMISSIONS.SERVICES_LIST]: 'List salon services',
  [PERMISSIONS.SERVICES_CREATE]: 'Create salon services',
  [PERMISSIONS.SERVICES_UPDATE]: 'Update salon services',
  [PERMISSIONS.SERVICES_DELETE]: 'Soft delete salon services',

  [PERMISSIONS.DAILY_REGISTERS_CREATE]: 'Create daily work registers',
  [PERMISSIONS.DAILY_REGISTERS_LIST]: 'List daily work registers',
  [PERMISSIONS.DAILY_REGISTERS_READ]: 'View daily work register details',
  [PERMISSIONS.DAILY_REGISTERS_VOID]: 'Void daily work registers',

  [PERMISSIONS.APPOINTMENTS_LIST]: 'List appointments',
  [PERMISSIONS.APPOINTMENTS_READ]: 'View appointment details',
  [PERMISSIONS.APPOINTMENTS_CREATE]: 'Create appointments',
  [PERMISSIONS.APPOINTMENTS_UPDATE]: 'Update appointments',
  [PERMISSIONS.APPOINTMENTS_CANCEL]: 'Cancel appointments',
  [PERMISSIONS.APPOINTMENTS_REASSIGN]: 'Reassign appointments',

  [PERMISSIONS.POS_OPEN_REGISTER]: 'Open cash register',
  [PERMISSIONS.POS_CLOSE_REGISTER]: 'Close cash register',
  [PERMISSIONS.POS_CREATE_SALE]: 'Create POS sales',
  [PERMISSIONS.POS_READ_SALES]: 'View POS sales',

  [PERMISSIONS.INVENTORY_LIST]: 'List inventory items',
  [PERMISSIONS.INVENTORY_READ]: 'View inventory details',
  [PERMISSIONS.INVENTORY_UPDATE]: 'Update inventory levels',
  [PERMISSIONS.INVENTORY_REQUEST_RESTOCK]: 'Request inventory restock',

  [PERMISSIONS.PAYROLL_LIST]: 'List payroll records',
  [PERMISSIONS.PAYROLL_READ]: 'View payroll details',
  [PERMISSIONS.PAYROLL_CALCULATE]: 'Calculate payroll',
  [PERMISSIONS.PAYROLL_APPROVE]: 'Approve payroll',

  [PERMISSIONS.AUDIT_LIST]: 'List audit logs',
  [PERMISSIONS.AUDIT_READ]: 'View audit log details',
};
