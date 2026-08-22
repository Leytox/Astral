import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EventsController } from './events.controller';
import { EventsGateway } from './events.gateway';
import { SseService } from './sse.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [EventsController],
  providers: [EventsGateway, SseService],
  exports: [EventsGateway, SseService],
})
export class EventsModule {}
