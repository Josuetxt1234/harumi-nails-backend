export interface AuthTokens {
  accessToken: string;
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
  /**
   * The client must block the session behind a password change while this is
   * true. Served by /auth/login, /auth/refresh and /auth/me alike, so a page
   * reload cannot slip past the gate.
   */
  mustChangePassword: boolean;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUserResponse;
}

/**
 * Refresh token material never reaches the HTTP body: the controller moves it
 * into an HttpOnly cookie.
 */
export interface IssuedRefreshToken {
  refreshToken: string;
  expiresAt: Date;
  rememberMe: boolean;
}

export interface AuthResult {
  body: LoginResponse;
  refreshToken: IssuedRefreshToken;
}
