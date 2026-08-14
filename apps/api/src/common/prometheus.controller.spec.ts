import { Test } from '@nestjs/testing';
import { CustomPrometheusController } from './prometheus.controller';
import type { Response } from 'express';

jest.mock('prom-client', () => ({
  register: {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    metrics: jest.fn(),
  },
}));

describe('CustomPrometheusController', () => {
  let controller: CustomPrometheusController;
  const mockRegister = jest.requireMock('prom-client').register;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomPrometheusController],
    }).compile();

    controller = moduleRef.get(CustomPrometheusController);
  });

  it('sets the Prometheus content type on the response', async () => {
    const response = { header: jest.fn() } as unknown as Response;
    mockRegister.metrics.mockResolvedValue('# HELP process_cpu_seconds_total');

    await controller.index(response);

    expect(response.header).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
  });

  it('returns the metrics collected by the default registry', async () => {
    const response = { header: jest.fn() } as unknown as Response;
    const metrics =
      '# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.\n' +
      '# TYPE process_cpu_user_seconds_total counter\n' +
      'process_cpu_user_seconds_total 1.234';
    mockRegister.metrics.mockResolvedValue(metrics);

    const result = await controller.index(response);

    expect(mockRegister.metrics).toHaveBeenCalledTimes(1);
    expect(result).toBe(metrics);
  });
});
