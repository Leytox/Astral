import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { AUDIO_QUALITIES } from '../common/consts';

@Injectable()
export class AudioService {
  constructor(@InjectQueue('upload') private readonly uploadQueue: Queue) {}
  private readonly logger = new Logger(AudioService.name);

  /**
   * Process an audio file and upload it to the queue
   * @param path The file path
   * @param name The file name
   * @returns {Promise<void>}
   */
  async processAudio(path: string, name: string): Promise<void> {
    try {
      for (const quality of AUDIO_QUALITIES) {
        const outputFilename = `${Date.now()}-${randomUUID()}-${name}.${quality.name}.m4a`;
        const outputPath = join(tmpdir(), outputFilename);
        let uploadJobQueued = false;

        try {
          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
              '-y',
              '-i',
              path,
              '-vn',
              '-c:a',
              'aac',
              '-b:a',
              quality.bitrate,
              '-movflags',
              '+faststart',
              outputPath,
            ]);

            ffmpeg.on('error', (err) => reject(err));
            ffmpeg.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`ffmpeg exited with code ${code}`));
            });
          });

          // enqueue upload job for the converted file
          await this.uploadQueue.add('upload', {
            Bucket: 'songs',
            Key: `${name}-${quality.name}.m4a`,
            ContentType: 'audio/mp4',
            tempPath: outputPath,
          });
          uploadJobQueued = true;
        } finally {
          if (!uploadJobQueued) {
            await unlink(outputPath).catch(() => {});
          }
        }
      }
    } catch (error: any) {
      this.logger.error(error);
      throw error;
    } finally {
      await unlink(path).catch(() => {});
    }
  }
}
