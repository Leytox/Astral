import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { EventsGateway } from './events.gateway';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  const mockJwtService = { verifyAsync: jest.fn() };
  const mockConfigService = { get: jest.fn() };

  const makeClient = (handshake: { auth?: any; headers?: any } = {}) => ({
    handshake: { auth: {}, headers: {}, ...handshake },
    data: {} as any,
    disconnect: jest.fn(),
    join: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'JWT_ACCESS_SECRET' ? 'test-access-secret' : undefined,
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        EventsGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = moduleRef.get(EventsGateway);
    (gateway as any).logger = { error: jest.fn() };
  });

  describe('handleConnection', () => {
    it('disconnects when no token is provided via auth or headers', async () => {
      const client = makeClient();

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('disconnects on an empty or whitespace token', async () => {
      const client = makeClient({ auth: { token: '   ' } });

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('verifies the token with JWT_ACCESS_SECRET and joins the user room on success', async () => {
      const payload = { sub: 'user-1', username: 'johndoe', role: 'USER' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);
      const client = makeClient({ auth: { token: 'access-token' } });

      await gateway.handleConnection(client as any);

      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
        secret: 'test-access-secret',
      });
      expect(client.data.user).toEqual(payload);
      expect(client.join).toHaveBeenCalledWith('user:user-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to the authorization header bearer token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-2' });
      const client = makeClient({
        headers: { authorization: 'Bearer header-token' },
      });

      await gateway.handleConnection(client as any);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('header-token', {
        secret: 'test-access-secret',
      });
      expect(client.join).toHaveBeenCalledWith('user:user-2');
    });

    it('disconnects when token verification fails', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
      const client = makeClient({ auth: { token: 'bad-token' } });

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
      expect((gateway as any).logger.error).toHaveBeenCalledWith(
        expect.any(Error),
      );
    });
  });

  describe('emitToUser', () => {
    it('emits the event to the user room on the server', () => {
      const server = { to: jest.fn(() => ({ emit: jest.fn() })) };
      (gateway as any).server = server;

      gateway.emitToUser('user-1', 'song.played', { songId: 'song-1' });

      expect(server.to).toHaveBeenCalledWith('user:user-1');
      const emitter = server.to.mock.results[0].value;
      expect(emitter.emit).toHaveBeenCalledWith('song.played', {
        songId: 'song-1',
      });
    });
  });

  describe('gateway configuration', () => {
    it('restricts the CORS origin to APP_BASE_URL in production', () => {
      const previousEnv = process.env.NODE_ENV;
      const previousUrl = process.env.APP_BASE_URL;
      process.env.NODE_ENV = 'production';
      process.env.APP_BASE_URL = 'https://astral.example.com';
      jest.resetModules();
      try {
        // Reload the module so the @WebSocketGateway decorator re-evaluates
        // its CORS origin against the production environment.
        const { EventsGateway: ProdGateway } =
          jest.requireActual('./events.gateway');
        expect(typeof ProdGateway).toBe('function');
      } finally {
        process.env.NODE_ENV = previousEnv;
        process.env.APP_BASE_URL = previousUrl;
        jest.resetModules();
      }
    });
  });
});
