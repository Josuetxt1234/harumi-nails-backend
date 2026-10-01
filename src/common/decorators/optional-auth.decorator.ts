import { SetMetadata } from '@nestjs/common';
import { IS_OPTIONAL_AUTH_KEY } from '../constants/auth.constants';

export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
