import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { User } from '../generated/prisma/client';

describe('TokenService', () => {
  let service: TokenService;
  const mockJwtService = { signAsync: jest.fn() };
  const mockConfigService = { get: jest.fn() };

  const user = {
    id: 'user-1',
    username: 'johndoe',
    role: 'USER',
  } as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      const values: Record<string, number | string> = {
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_ACCESS_EXPIRES_IN: 900_000, // milliseconds
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRES_IN: 604_800_000, // milliseconds
      };
      return values[key];
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = moduleRef.get(TokenService);
  });

  describe('generateAccessToken', () => {
    it('signs a token with user claims, the access secret, and expiry in seconds', async () => {
      mockJwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.generateAccessToken(user);

      expect(result).toBe('access-token');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', username: 'johndoe', role: 'USER' },
        { secret: 'access-secret', expiresIn: 900 },
      );
    });

    it('casts the ADMIN role through', async () => {
      mockJwtService.signAsync.mockResolvedValue('access-token');

      await service.generateAccessToken({ ...user, role: 'ADMIN' });

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ADMIN' }),
        expect.anything(),
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('signs a token with sub, username, jti, the refresh secret, and expiry in seconds', async () => {
      mockJwtService.signAsync.mockResolvedValue('refresh-token');

      const result = await service.generateRefreshToken(user, 'session-1');

      expect(result).toBe('refresh-token');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', username: 'johndoe', jti: 'session-1' },
        { secret: 'refresh-secret', expiresIn: 604_800 },
      );
    });
  });
});
