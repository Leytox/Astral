import { Module } from '@nestjs/common';

import { SongsModule } from '../songs/songs.module';
import { UploadModule } from '../upload/upload.module';
import { AlbumsController } from './albums.controller';
import { AlbumsService } from './albums.service';

@Module({
  imports: [UploadModule, SongsModule],
  controllers: [AlbumsController],
  providers: [AlbumsService],
  exports: [AlbumsService],
})
export class AlbumsModule {}
