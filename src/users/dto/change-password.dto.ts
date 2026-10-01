import { IsPassword } from '../../common/decorators/is-password.decorator';

export class ChangePasswordDto {
  @IsPassword({ optional: true, propertyName: 'Current password' })
  currentPassword?: string;

  @IsPassword({ propertyName: 'New password' })
  newPassword!: string;
}
