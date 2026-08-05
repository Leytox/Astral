import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheck,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import { RedisHealthIndicator } from './redis.health';
import { S3HealthIndicator } from './s3.health';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly prismaService: PrismaService,
    private readonly redis: RedisHealthIndicator,
    private readonly s3: S3HealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Application health check' })
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.prismaService),
      () => this.redis.pingCheck('redis'),
      () => this.s3.pingCheck('s3'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024), // 200 MB
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // 500 MB
      () =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.9, // 90%
          path: '/',
        }),
    ]);
  }
}
