export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse extends AuthTokens {
  user: AuthUserResponse;
}
