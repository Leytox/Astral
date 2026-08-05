import { Module } from '@nestjs/common';
import { AlbumsController } from './albums.controller';
import { AlbumsService } from './albums.service';
import { UploadModule } from '../upload/upload.module';
import { SongsModule } from '../songs/songs.module';

@Module({
  imports: [UploadModule, SongsModule],
  controllers: [AlbumsController],
  providers: [AlbumsService],
  exports: [AlbumsService],
})
export class AlbumsModule {}
