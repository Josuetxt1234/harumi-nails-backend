import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import appConfig from './config/app.config';
import cloudinaryConfig from './config/cloudinary.config';
import emailConfig from './config/email.config';
import jwtConfig from './config/jwt.config';
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
      load: [appConfig, jwtConfig, emailConfig, cloudinaryConfig],
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
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
