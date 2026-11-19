import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { loadEnv } from './common/env.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(
    helmet({
      contentSecurityPolicy: true,
      hsts: { maxAge: 31536000, includeSubDomains: true },
    }),
  );

  app.enableCors({
    origin: env.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.setGlobalPrefix('api');

  await app.listen(env.port);
  console.log(`HealthOS API listening on port ${env.port} (${env.nodeEnv})`);
}

bootstrap();
