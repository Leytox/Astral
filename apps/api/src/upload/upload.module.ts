import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Module } from 'nestjs-s3';
import { UploadService } from './upload.service';
import { UploadProcessor } from './upload.processor';
import { EventsModule } from '../events/events.module';
import { PresignService } from './presign.service';

@Module({
  imports: [
    S3Module.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        config: {
          credentials: {
            accessKeyId: config.get<string>('S3_ACCESS_TOKEN') as string,
            secretAccessKey: config.get<string>(
              'S3_SECRET_ACCESS_KEY',
            ) as string,
          },
          region: 'local',
          endpoint: config.get<string>('S3_ENDPOINT'),
          forcePathStyle: true,
          signatureVersion: 'v4',
        },
      }),
    }),
    BullModule.registerQueue({ name: 'upload' }),
    EventsModule,
  ],
  providers: [UploadService, PresignService, UploadProcessor],
  exports: [UploadService, PresignService, BullModule],
})
export class UploadModule {}
