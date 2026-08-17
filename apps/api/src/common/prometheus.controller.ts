import { Controller, Get, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { Response } from 'express';

@ApiTags('Metrics')
@Controller()
export class CustomPrometheusController extends PrometheusController {
  @ApiOperation({
    summary: 'Prometheus metrics',
    description:
      'Exposes application metrics in the Prometheus text exposition format (version 0.0.4). Configure your Prometheus scraper to collect from this endpoint.',
  })
  @ApiProduces('text/plain; version=0.0.4; charset=utf-8')
  @ApiOkResponse({
    description: 'Metrics in the Prometheus text exposition format',
    schema: {
      type: 'string',
      example:
        '# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.\n# TYPE process_cpu_user_seconds_total counter\nprocess_cpu_user_seconds_total 1.234',
    },
  })
  @Get()
  index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
