import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { AudioProcessor } from './audio.processor';
import { AudioService } from './audio.service';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';

@Module({
  imports: [
    UploadModule,
    BullModule.registerQueue({
      name: 'audio',
    }),
    AuthModule,
  ],
  controllers: [SongsController],
  providers: [SongsService, AudioService, AudioProcessor],
  exports: [SongsService],
})
export class SongsModule {}
