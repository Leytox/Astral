import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { RedisIoAdapter } from './redis-io.adapter';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(),
}));

const mockCreateClient = createClient as unknown as jest.Mock;
const mockCreateAdapter = createAdapter as unknown as jest.Mock;

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;
  let createIOServerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    adapter = new RedisIoAdapter();
    // The sandbox blocks socket binding (EPERM on listen), so stub the parent's
    // server factory to keep the subclass behavior under test.
    createIOServerSpy = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({ adapter: jest.fn() } as any);
  });

  afterEach(() => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    createIOServerSpy.mockRestore();
  });

  describe('connectToRedis', () => {
    it('creates pub/sub clients and assigns the redis adapter constructor', async () => {
      const subClient = { connect: jest.fn() };
      const pubClient = {
        connect: jest.fn(),
        duplicate: jest.fn(() => subClient),
      };
      mockCreateClient.mockReturnValue(pubClient);
      const adapterConstructor = jest.fn();
      mockCreateAdapter.mockReturnValue(adapterConstructor);

      await adapter.connectToRedis();

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'redis://localhost:6379',
      });
      expect(pubClient.duplicate).toHaveBeenCalledTimes(1);
      expect(pubClient.connect).toHaveBeenCalledTimes(1);
      expect(subClient.connect).toHaveBeenCalledTimes(1);
      expect(mockCreateAdapter).toHaveBeenCalledWith(pubClient, subClient);
      expect((adapter as any).adapterConstructor).toBe(adapterConstructor);
    });
  });

  describe('createIOServer', () => {
    it('applies the redis adapter constructor to the io server', () => {
      const adapterConstructor = jest.fn();
      (adapter as any).adapterConstructor = adapterConstructor;
      const fakeServer = { adapter: jest.fn() };
      createIOServerSpy.mockReturnValue(fakeServer as any);

      const result = adapter.createIOServer(3001, { cors: true } as any);

      expect(createIOServerSpy).toHaveBeenCalledWith(3001, { cors: true });
      expect(fakeServer.adapter).toHaveBeenCalledWith(adapterConstructor);
      expect(result).toBe(fakeServer);
    });
  });
});
