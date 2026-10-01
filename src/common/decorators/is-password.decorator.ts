import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;

type IsPasswordOptions = {
  optional?: boolean;
  propertyName?: string;
};

export function IsPassword(options: IsPasswordOptions = {}) {
  const propertyName = options.propertyName ?? 'Password';
  const minLengthMessage = `${propertyName} must be at least ${PASSWORD_MIN_LENGTH} characters long.`;

  const validators = [
    IsString({ message: `${propertyName} must be a string.` }),
    MinLength(PASSWORD_MIN_LENGTH, { message: minLengthMessage }),
  ];

  if (options.optional) {
    return applyDecorators(IsOptional(), ...validators);
  }

  return applyDecorators(
    IsNotEmpty({ message: `${propertyName} is required.` }),
    ...validators,
  );
}
