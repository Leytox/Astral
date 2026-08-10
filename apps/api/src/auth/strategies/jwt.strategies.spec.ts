import { ConfigService } from '@nestjs/config';
import { AccessTokenStrategy } from './jwt-access.strategy';
import { RefreshTokenStrategy } from './jwt-refresh.strategy';
import { OptionalTokenStrategy } from './jwt-optional.strategy';

const mockConfig = {
  get: jest.fn((key: string) =>
    key.includes('SECRET') ? 'secret' : undefined,
  ),
} as unknown as ConfigService;

describe('JWT strategies', () => {
  it('AccessTokenStrategy returns the payload from validate', () => {
    const strategy = new AccessTokenStrategy(mockConfig);
    const payload = { sub: 'user-1', username: 'johndoe', role: 'USER' };

    expect(strategy.validate(payload)).toEqual(payload);
  });

  it('RefreshTokenStrategy returns the payload from validate', () => {
    const strategy = new RefreshTokenStrategy(mockConfig);
    const payload = { sub: 'user-1', username: 'johndoe', jti: 'jti-1' };

    expect(strategy.validate(payload)).toEqual(payload);
  });

  it('RefreshTokenStrategy extracts the refresh token from the request cookie', () => {
    const strategy = new RefreshTokenStrategy(mockConfig) as any;
    const extractor = strategy._jwtFromRequest as (req: any) => string;

    expect(extractor({ cookies: { refresh_token: 'cookie-token' } })).toBe(
      'cookie-token',
    );
    expect(extractor({ cookies: {} })).toBeUndefined();
    expect(extractor({})).toBeUndefined();
  });

  it('OptionalTokenStrategy returns the payload from validate', () => {
    const strategy = new OptionalTokenStrategy(mockConfig);
    const payload = { sub: 'user-1', username: 'johndoe', role: 'USER' };

    expect(strategy.validate(payload)).toEqual(payload);
  });
});
