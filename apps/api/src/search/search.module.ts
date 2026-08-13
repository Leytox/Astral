import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [AuthModule, UploadModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
