import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
} from 'class-validator';
import { IsPassword } from '../../common/decorators/is-password.decorator';

export class LoginDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  email!: string;

  @IsPassword()
  password!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return false;
    }

    return value === true || value === 'true';
  })
  @IsBoolean({ message: 'Remember me must be a boolean value.' })
  rememberMe?: boolean = false;
}
