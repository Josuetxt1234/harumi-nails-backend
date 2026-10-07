import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { MustChangePasswordGuard } from './auth/guards/must-change-password.guard';
import { CommonModule } from './common/common.module';
import {
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_TTL_MS,
  RATE_LIMIT_ERROR_MESSAGE,
} from './common/constants/rate-limit.constants';
import { AuthorizationRequiredGuard } from './common/guards/authorization-required.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import appConfig from './config/app.config';
import cloudinaryConfig from './config/cloudinary.config';
import emailConfig from './config/email.config';
import { validateEnv } from './config/env.validation';
import jwtConfig from './config/jwt.config';
import securityConfig from './config/security.config';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EmailModule } from './email/email.module';
import { HashingModule } from './hashing/hashing.module';
import { DailyRegistersModule } from './daily-registers/daily-registers.module';
import { AdvancesModule } from './modules/advances/advances.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { SalonServicesModule } from './salon-services/salon-services.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        emailConfig,
        cloudinaryConfig,
        securityConfig,
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        errorMessage: RATE_LIMIT_ERROR_MESSAGE,
        throttlers: [
          {
            name: 'default',
            ttl:
              configService.get<number>('security.rateLimit.ttl') ??
              DEFAULT_RATE_LIMIT_TTL_MS,
            limit:
              configService.get<number>('security.rateLimit.limit') ??
              DEFAULT_RATE_LIMIT_MAX,
          },
        ],
      }),
    }),
    CommonModule,
    HashingModule,
    PrismaModule,
    CloudinaryModule,
    EmailModule,
    PermissionsModule,
    UsersModule,
    RolesModule,
    SalonServicesModule,
    DailyRegistersModule,
    AdvancesModule,
    PayrollModule,
    InventoryModule,
    NotificationsModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MustChangePasswordGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationRequiredGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
