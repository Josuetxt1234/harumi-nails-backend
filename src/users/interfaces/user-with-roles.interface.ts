export interface UserWithRoles {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  password: string;
  isActive: boolean;
  avatarUrl: string | null;
  roles: string[];
}

export interface UserProfileBase {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
}

export interface UserProfile extends UserProfileBase {
  permissions: string[];
}

export interface UserDetailBase extends UserProfileBase {
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDetail extends UserDetailBase {
  permissions: string[];
}

export interface UserListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  avatarUrl: string | null;
  roles: string[];
  createdAt: Date;
}

export interface PaginatedUsers {
  data: UserListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  createdById: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  password?: string;
  updatedById: string;
}

export interface ListUsersFilters {
  search?: string;
  isActive?: boolean;
  roleId?: string;
  page: number;
  limit: number;
}

export interface UsersMetrics {
  total: number;
  active: number;
  inactive: number;
}
