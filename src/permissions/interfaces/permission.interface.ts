export interface PermissionSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface RolePermissionSummary extends PermissionSummary {
  assignedAt: Date;
}
