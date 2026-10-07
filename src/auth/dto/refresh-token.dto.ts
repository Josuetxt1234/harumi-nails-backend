import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// The refresh token travels in an HttpOnly cookie. The body field is only a
// fallback for non-browser clients such as the E2E scripts.
export class RefreshTokenDto {
  @IsOptional()
  @IsString({ message: 'Refresh token must be a string.' })
  @IsNotEmpty({ message: 'Refresh token is required.' })
  refreshToken?: string;
}
