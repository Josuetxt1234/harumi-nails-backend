export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  /**
   * Read from the database on every request, not from the token, so revoking
   * a password takes effect without waiting for the access token to expire.
   */
  mustChangePassword: boolean;
}
