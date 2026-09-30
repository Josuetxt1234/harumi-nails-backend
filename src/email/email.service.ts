import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { EMAIL_ERROR_MESSAGES } from './constants/email.constants';
import {
  SendEmailOptions,
  SendEmailResult,
} from './interfaces/send-email-options.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('email.enabled') ?? false;
  }

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('email.host') &&
        this.configService.get<string>('email.user') &&
        this.configService.get<string>('email.password'),
    );
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isEnabled()) {
      this.logger.warn('Email verification skipped because email is disabled.');
      return false;
    }

    this.assertConfigured();

    try {
      await this.getTransporter().verify();
      this.logger.log('Email transporter connection verified successfully.');
      return true;
    } catch (error) {
      this.logger.error('Email transporter verification failed.', error);
      return false;
    }
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult | null> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `Email delivery is disabled. Skipped message to ${this.formatRecipients(options.to)} with subject "${options.subject}".`,
      );
      return null;
    }

    this.assertConfigured();

    if (!options.text && !options.html) {
      throw new InternalServerErrorException(
        'Email content is required. Provide text or html.',
      );
    }

    try {
      const response = await this.getTransporter().sendMail({
        from: this.configService.get<string>('email.from'),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      });

      this.logger.log(
        `Email sent to ${this.formatRecipients(options.to)} with subject "${options.subject}". Message ID: ${response.messageId}`,
      );

      return {
        messageId: response.messageId,
        accepted: response.accepted.map(String),
        rejected: response.rejected.map(String),
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${this.formatRecipients(options.to)} with subject "${options.subject}".`,
        error,
      );
      throw new InternalServerErrorException(EMAIL_ERROR_MESSAGES.SEND_FAILED);
    }
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(EMAIL_ERROR_MESSAGES.NOT_CONFIGURED);
    }
  }

  private getTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('email.host');
    const port = this.configService.get<number>('email.port') ?? 587;
    const secure = this.configService.get<boolean>('email.secure') ?? false;
    const user = this.configService.get<string>('email.user');
    const password = this.configService.get<string>('email.password');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password,
      },
    });

    return this.transporter;
  }

  private formatRecipients(recipients: string | string[]): string {
    return Array.isArray(recipients) ? recipients.join(', ') : recipients;
  }
}
