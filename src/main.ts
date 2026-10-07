import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const trustProxy = configService.get<boolean | number | string>(
    'security.trustProxy',
  );

  if (trustProxy !== false && trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const allowedOrigins =
    configService.get<string[]>('security.allowedOrigins') ?? [];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      const isAllowed =
        !origin || allowedOrigins.includes(origin.replace(/\/+$/, ''));

      callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  const port = configService.get<number>('port') ?? 3000;
  // Railway injects PORT and routes traffic to 0.0.0.0. Binding only to
  // localhost would make the service unreachable from the public proxy.
  await app.listen(port, '0.0.0.0');

  logger.log(`Listening on 0.0.0.0:${port}`);
  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ') || 'none'}`);
}

bootstrap();
