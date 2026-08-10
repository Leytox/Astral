import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from './prisma.service';

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}));

const mockPrismaPg = PrismaPg as unknown as jest.Mock;

describe('PrismaService', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('connects to the database on module init', async () => {
    // Build the instance off the prototype so the PrismaPg constructor (and
    // the real PrismaClient super()) never runs.
    const service = Object.create(PrismaService.prototype) as PrismaService;
    const connect = jest.fn();
    (service as any).$connect = connect;

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('constructs the client with a PrismaPg adapter for the configured DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/astral';
    mockPrismaPg.mockClear();

    const service = new PrismaService();

    expect(service).toBeInstanceOf(PrismaService);
    expect(mockPrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@localhost:5432/astral',
    });
  });
});
