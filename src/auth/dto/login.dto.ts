import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Login deliberately avoids @IsEmail / @IsPassword: any format feedback here
// would disclose the password policy and whether an address is well-formed
// before the credentials are actually checked. Every failure returns the same
// 401 through the controller's exceptionFactory.
export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return false;
    }

    return value === true || value === 'true';
  })
  @IsBoolean()
  rememberMe?: boolean = false;
}
