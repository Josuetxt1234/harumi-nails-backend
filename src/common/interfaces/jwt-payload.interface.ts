export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  /** Session id, used to revoke access tokens as soon as the session dies. */
  sid: string;
}
