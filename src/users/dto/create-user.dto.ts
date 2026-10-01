import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { IsPassword } from '../../common/decorators/is-password.decorator';

function parseRoleIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return undefined;
}

export class CreateUserDto {
  @IsString({ message: 'First name must be a string.' })
  @IsNotEmpty({ message: 'First name is required.' })
  firstName!: string;

  @IsString({ message: 'Last name must be a string.' })
  @IsNotEmpty({ message: 'Last name is required.' })
  lastName!: string;

  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email!: string;

  @IsPassword()
  password!: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string.' })
  phone?: string;

  @Transform(({ value }) => parseRoleIds(value) ?? [])
  @ArrayMinSize(1, { message: 'At least one role must be assigned.' })
  @IsUUID('4', { each: true, message: 'Each role ID must be a valid UUID.' })
  roleIds!: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean({ message: 'isActive must be a boolean value.' })
  isActive?: boolean;
}
