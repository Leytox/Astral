import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessJwtPayload } from '@repo/types';
import type { Request, Response } from 'express';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { User } from '../common/decorators/user.decorator';
import { SseService } from './sse.service';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly sseService: SseService) {}

  @Get('subscribe')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Subscribe to real-time Server-Sent Events stream' })
  @ApiProduces('text/event-stream')
  async sse(
    @Req() req: Request,
    @Res() res: Response,
    @User() user: AccessJwtPayload,
  ): Promise<void> {
    await this.sseService.registerClient(user.sub, req, res);
  }
}
