import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { writeFile, copyFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

@Injectable()
export class UploadService {
  constructor(@InjectQueue('upload') private readonly uploadQueue: Queue) {}

  /**
   * Upload a file to the queue
   * @param source The file source as a Buffer or string
   * @param filename The file name
   * @param mimetype The file mimetype
   * @param bucket The S3 bucket name
   * @param userId The user id
   * @returns {Promise<void>}
   */
  async uploadFile(
    source: Buffer | string,
    filename: string,
    mimetype: string,
    bucket: string,
    userId?: string,
  ): Promise<void> {
    let tempPath: string;
    if (typeof source === 'string') {
      tempPath = join(tmpdir(), `${Date.now()}-upload-${filename}`);
      await copyFile(source, tempPath);
    } else {
      tempPath = join(tmpdir(), `${Date.now()}-${filename}`);
      await writeFile(tempPath, source);
    }
    await this.uploadQueue.add('upload', {
      Bucket: bucket,
      Key: filename,
      ContentType: mimetype,
      tempPath,
      userId,
    });
  }
}
