import crypto from 'node:crypto';

import KeyvRedis from '@keyv/redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { join } from 'path';

import { AlbumsModule } from './albums/albums.module';
import { AuthModule } from './auth/auth.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { CustomPrometheusController } from './common/prometheus.controller';
import { CustomConfigModule } from './config/config.module';
import { PrismaModule } from './database/prisma.module';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { GenresModule } from './genres/genres.module';
import { HealthModule } from './health/health.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { SearchModule } from './search/search.module';
import { SongsModule } from './songs/songs.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    UploadModule,
    EmailModule,
    CustomConfigModule,
    AuthModule,
    UsersModule,
    SongsModule,
    GenresModule,
    AlbumsModule,
    PlaylistsModule,
    EventsModule,
    SearchModule,
    HealthModule,
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
      controller: CustomPrometheusController,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          customProps: (req) => ({
            userId: (req as { user?: { sub?: string } }).user?.sub,
          }),
          transport: {
            target: 'pino-loki',
            options: {
              batching: true,
              interval: 5,
              host: config.get<string>('LOKI_HOST'),
            },
          },
        },
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 20,
        },
      ],
      errorMessage: 'Too many requests',
    }),
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [
          new KeyvRedis(
            `redis://${config.get<string>('REDIS_HOST')}:${config.get<string>('REDIS_PORT')}`,
          ),
        ],
        ttl: 60 * 1000,
      }),
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: Number(config.get<string>('REDIS_PORT')),
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
  ],
})
export class AppModule {}
