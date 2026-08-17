import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.cacheManager.set('health:redis', 'pong', 1000);
      const result = await this.cacheManager.get('health:redis');
      if (result === 'pong') return indicator.up();
      return indicator.down({ message: 'Redis read-back mismatch' });
    } catch {
      return indicator.down({ message: 'Redis unreachable' });
    }
  }
}
