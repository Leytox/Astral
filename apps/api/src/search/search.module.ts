import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AuthModule, UploadModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
