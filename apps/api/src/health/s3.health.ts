import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { InjectS3, type S3 } from 'nestjs-s3';

@Injectable()
export class S3HealthIndicator {
  constructor(
    @InjectS3() private readonly s3: S3,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const buckets = await this.s3.listBuckets();
      return indicator.up({ buckets: buckets.Buckets?.length ?? 0 });
    } catch {
      return indicator.down({ message: 'S3 unreachable' });
    }
  }
}
