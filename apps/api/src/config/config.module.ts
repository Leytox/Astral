import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .required(),
        PORT: Joi.number().port().required(),
        DATABASE_URL: Joi.string().uri().required(),
        S3_ACCESS_TOKEN: Joi.string().min(8).required(),
        S3_SECRET_ACCESS_KEY: Joi.string().min(8).required(),
        S3_ENDPOINT: Joi.string().uri().required(),
        REDIS_HOST: Joi.string().hostname().required(),
        REDIS_PORT: Joi.number().port().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).max(64).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.number().required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).max(64).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.number().required(),
        SALT_ROUNDS: Joi.number().min(8).max(16).required(),
        SMTP_HOST: Joi.string().hostname().required(),
        SMTP_PORT: Joi.number().port().required(),
        SMTP_USER: Joi.string().min(2).max(50).required(),
        SMTP_PASS: Joi.string().min(8).required(),
        SMTP_SECURE: Joi.boolean().required(),
        APP_BASE_URL: Joi.string().uri().required(),
        LOKI_HOST: Joi.string().uri().required(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
  ],
})
export class CustomConfigModule {}
