-- Partial unique indexes for soft-delete–aware uniqueness.
-- Prisma does not model partial unique indexes in schema.prisma.
-- Apply this SQL after creating tables (e.g. append to the migration, or run once with prisma db execute).

-- Users: reuse email after soft delete
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_active_key"
  ON "users" ("email")
  WHERE "isDeleted" = false;

-- Roles: reuse name after soft delete
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_active_key"
  ON "roles" ("name")
  WHERE "isDeleted" = false;

-- Permissions: reuse name after soft delete
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_name_active_key"
  ON "permissions" ("name")
  WHERE "isDeleted" = false;

-- UserRole: one active assignment per user+role; soft-deleted rows keep history
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_role_active_key"
  ON "user_roles" ("userId", "roleId")
  WHERE "isDeleted" = false;

-- RolePermission: one active assignment per role+permission; soft-deleted rows keep history
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_permission_active_key"
  ON "role_permissions" ("roleId", "permissionId")
  WHERE "isDeleted" = false;
