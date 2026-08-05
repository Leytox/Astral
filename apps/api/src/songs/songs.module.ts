import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SongsService } from './songs.service';
import { SongsController } from './songs.controller';
import { UploadModule } from '../upload/upload.module';
import { AudioProcessor } from './audio.processor';
import { AudioService } from './audio.service';
import { AuthModule } from '../auth/auth.module';

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
