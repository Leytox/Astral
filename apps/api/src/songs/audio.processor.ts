import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AudioService } from './audio.service';

@Processor('audio')
export class AudioProcessor extends WorkerHost {
  constructor(private readonly audioService: AudioService) {
    super();
  }

  async process(job: Job<{ path: string; name: string }>): Promise<void> {
    try {
      const { path, name } = job.data;
      await this.audioService.processAudio(path, name);
    } catch (error) {
      console.error('Error processing audio:', error);
      throw error;
    }
  }
}
