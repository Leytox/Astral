import { PutObjectRequest } from '@aws-sdk/client-s3';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import type { S3 } from 'nestjs-s3';
import { InjectS3 } from 'nestjs-s3';

import { EventsGateway } from '../events/events.gateway';

@Processor('upload')
export class UploadProcessor extends WorkerHost {
  constructor(
    @InjectS3() private readonly s3: S3,
    private readonly eventsGateway: EventsGateway,
  ) {
    super();
  }
  private readonly logger = new Logger(UploadProcessor.name);

  async process(
    job: Job<PutObjectRequest & { tempPath: string; userId: string | null }>,
  ): Promise<void> {
    const { Bucket, Key, ContentType, tempPath, userId } = job.data;
    let uploaded = false;
    try {
      const fileStream = createReadStream(tempPath);
      await this.s3.putObject({ Bucket, Key, Body: fileStream, ContentType });
      uploaded = true;
      if (userId)
        this.eventsGateway.emitToUser(userId, 'upload:success', {
          Key,
          message: 'Song uploaded successfully',
        });
    } catch (error: any) {
      this.logger.error(error);
      if (userId)
        this.eventsGateway.emitToUser(userId, 'upload:error', {
          Key,
          message: 'Upload has failed',
        });
      throw error;
    } finally {
      if (uploaded) {
        await unlink(tempPath).catch(() => {});
      }
    }
  }
}
