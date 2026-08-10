import { Test } from '@nestjs/testing';
import {
  DiskHealthIndicator,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { S3HealthIndicator } from './s3.health';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  const mockHealthCheckService = { check: jest.fn() };
  const mockPrismaHealthIndicator = { pingCheck: jest.fn() };
  const mockPrismaService = {};
  const mockRedisHealthIndicator = { pingCheck: jest.fn() };
  const mockS3HealthIndicator = { pingCheck: jest.fn() };
  const mockMemoryHealthIndicator = {
    checkHeap: jest.fn(),
    checkRSS: jest.fn(),
  };
  const mockDiskHealthIndicator = { checkStorage: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealthIndicator },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisHealthIndicator, useValue: mockRedisHealthIndicator },
        { provide: S3HealthIndicator, useValue: mockS3HealthIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryHealthIndicator },
        { provide: DiskHealthIndicator, useValue: mockDiskHealthIndicator },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('delegates to HealthCheckService.check with all six indicators', () => {
    const checkResult = { status: 'ok' };
    mockHealthCheckService.check.mockReturnValue(checkResult);

    const result = controller.check();

    expect(result).toBe(checkResult);
    expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);

    const indicators = mockHealthCheckService.check.mock.calls[0][0];
    expect(indicators).toHaveLength(6);

    indicators[0]();
    expect(mockPrismaHealthIndicator.pingCheck).toHaveBeenCalledWith(
      'database',
      mockPrismaService,
    );

    indicators[1]();
    expect(mockRedisHealthIndicator.pingCheck).toHaveBeenCalledWith('redis');

    indicators[2]();
    expect(mockS3HealthIndicator.pingCheck).toHaveBeenCalledWith('s3');

    indicators[3]();
    expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      200 * 1024 * 1024,
    );

    indicators[4]();
    expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
      'memory_rss',
      500 * 1024 * 1024,
    );

    indicators[5]();
    expect(mockDiskHealthIndicator.checkStorage).toHaveBeenCalledWith('disk', {
      thresholdPercent: 0.9,
      path: '/',
    });
  });
});
