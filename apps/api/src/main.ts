import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { Logger as NestLogger } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RedisIoAdapter } from './events/redis-io.adapter';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const redisIoAdapter = new RedisIoAdapter(app.getHttpServer());
  await redisIoAdapter.connectToRedis();

  app.useLogger(app.get(Logger));
  app.useWebSocketAdapter(redisIoAdapter);
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/docs') && process.env.NODE_ENV !== 'production') {
      return next(); // Skip helmet entirely for Swagger
    }
    helmet()(req, res, next);
  });
  app.enableCors({
    origin: process.env.APP_BASE_URL,
    credentials: true,
  });
  app.use(compression());
  const config = new DocumentBuilder()
    .setTitle('Astral API')
    .setDescription(
      'The Astral is a free and open source project created to master fullstack skills',
    )
    .setVersion('1.0')
    .setContact('Ilya Devder', 'https://t.me/Leytox', 'iladevder@gmail.com')
    .setLicense('AGPLv3', 'https://spdx.org/licenses/AGPL-3.0-or-later.html')
    .addServer('http://localhost:5000', 'Local development')
    .addBearerAuth(
      {
        description: 'JWT Access Token',
        type: 'http',
        in: 'header',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
      description: 'JWT refresh token stored in an HttpOnly cookie',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document), {
      customCssUrl: '/public/swagger.css',
    });
  }
  app.set('trust proxy', 1);
  await app.listen(process.env.PORT ?? 5000);
}

bootstrap()
  .then(() => {
    new NestLogger('Bootstrap').log('Application has started');
  })
  .catch((error) => {
    new NestLogger('Bootstrap').error(
      'Application has crashed with an error:',
      error,
    );
  });
