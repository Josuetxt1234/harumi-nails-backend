import { IsOptional, IsString } from 'class-validator';
import { IsPassword } from '../../common/decorators/is-password.decorator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'First name must be a string.' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Last name must be a string.' })
  lastName?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string.' })
  phone?: string;

  @IsPassword({ optional: true })
  password?: string;
}
