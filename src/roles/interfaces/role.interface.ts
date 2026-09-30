export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateRoleData {
  name: string;
  description?: string | null;
  createdById: string;
}

export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  updatedById: string;
}
