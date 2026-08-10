import { Test } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { S3HealthIndicator } from './s3.health';

describe('S3HealthIndicator', () => {
  let indicator: S3HealthIndicator;
  const mockS3 = { listBuckets: jest.fn() };
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
        S3HealthIndicator,
        { provide: 'default_S3ModuleConnectionToken', useValue: mockS3 },
        {
          provide: HealthIndicatorService,
          useValue: mockHealthIndicatorService,
        },
      ],
    }).compile();

    indicator = moduleRef.get(S3HealthIndicator);
  });

  it('reports up with the bucket count when listBuckets resolves', async () => {
    mockS3.listBuckets.mockResolvedValue({
      Buckets: [{ Name: 'bucket-a' }, { Name: 'bucket-b' }],
    });

    await expect(indicator.pingCheck('s3')).resolves.toEqual({
      status: 'up',
      buckets: 2,
    });
  });

  it('reports up with zero buckets when the response has no Buckets array', async () => {
    mockS3.listBuckets.mockResolvedValue({});

    await expect(indicator.pingCheck('s3')).resolves.toEqual({
      status: 'up',
      buckets: 0,
    });
  });

  it('reports down when s3 is unreachable', async () => {
    mockS3.listBuckets.mockRejectedValue(new Error('network error'));

    await expect(indicator.pingCheck('s3')).resolves.toEqual({
      status: 'down',
      message: 'S3 unreachable',
    });
  });
});
