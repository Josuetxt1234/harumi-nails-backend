import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AUTH_ERROR_MESSAGES } from '../../common/constants/auth.constants';

/**
 * The global ValidationPipe runs before any route-level pipe, so malformed
 * login payloads would otherwise answer 400 with the field rules attached.
 * Collapsing them into the same 401 keeps every failure indistinguishable.
 */
@Catch(BadRequestException)
export class LoginFailureFilter implements ExceptionFilter {
  catch(_exception: BadRequestException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(HttpStatus.UNAUTHORIZED).json({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
      error: 'Unauthorized',
    });
  }
}
