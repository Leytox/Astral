import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  const mockCacheManager = { get: jest.fn(), set: jest.fn() };
  const mockHealthIndicatorService = {
    check: jest.fn(() => ({
      up: jest.fn((d: any) => ({ status: 'up', ...d })),
      down: jest.fn((d: any) => ({ status: 'down', ...d })),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        {
          provide: HealthIndicatorService,
          useValue: mockHealthIndicatorService,
        },
      ],
    }).compile();

    indicator = moduleRef.get(RedisHealthIndicator);
  });

  it('reports up when the pong round-trip succeeds', async () => {
    mockCacheManager.set.mockResolvedValue(undefined);
    mockCacheManager.get.mockResolvedValue('pong');

    await expect(indicator.pingCheck('redis')).resolves.toEqual({
      status: 'up',
    });

    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('redis');
    expect(mockCacheManager.set).toHaveBeenCalledWith(
      'health:redis',
      'pong',
      1000,
    );
    expect(mockCacheManager.get).toHaveBeenCalledWith('health:redis');
  });

  it('reports down on a read-back mismatch', async () => {
    mockCacheManager.get.mockResolvedValue('something-else');

    await expect(indicator.pingCheck('redis')).resolves.toEqual({
      status: 'down',
      message: 'Redis read-back mismatch',
    });
  });

  it('reports down when redis is unreachable', async () => {
    mockCacheManager.set.mockRejectedValue(new Error('connection refused'));

    await expect(indicator.pingCheck('redis')).resolves.toEqual({
      status: 'down',
      message: 'Redis unreachable',
    });
  });
});
